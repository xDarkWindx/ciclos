using System.Collections.Generic;
using RimWorld;
using Verse;
using Verse.AI;

namespace Wisk
{
    public static class WiskUtility
    {
        public static List<Pawn> Threats(Pawn dog)
        {
            var list = new List<Pawn>();
            if (dog.Map == null) return list;
            foreach (Pawn p in dog.Map.mapPawns.AllPawnsSpawned)
            {
                if (p.Downed || p.Dead || p.IsPrisonerOfColony) continue;
                if (p.HostileTo(dog) && !p.IsPsychologicallyInvisible()) list.Add(p);
            }
            return list;
        }

        public static float MinThreatDist(IntVec3 cell, List<Pawn> threats)
        {
            float best = 99f;
            foreach (Pawn t in threats)
            {
                float d = t.Position.DistanceTo(cell);
                if (d < best) best = d;
            }
            return best;
        }

        public static bool ThreatNear(Pawn dog, float radius) =>
            MinThreatDist(dog.Position, Threats(dog)) < radius;

        /// <summary>Refúgio: cama do dono/vínculo → cama própria (se longe das ameaças) → célula segura da home area.</summary>
        public static IntVec3 FindRefuge(Pawn dog)
        {
            List<Pawn> threats = Threats(dog);

            var beds = new List<Building_Bed>();
            Pawn fav = CompWisk.FindBondOrMaster(dog);
            Building_Bed favBed = fav?.ownership?.OwnedBed;
            if (favBed != null) beds.Add(favBed);          // 1º a cama do dono
            Building_Bed own = dog.ownership?.OwnedBed;
            if (own != null) beds.Add(own);                // 2º a cama dele

            foreach (Building_Bed bed in beds)
            {
                if (bed.Destroyed || !bed.Spawned || bed.Map != dog.Map || bed.IsForbidden(dog)) continue;
                if (MinThreatDist(bed.Position, threats) < 5f) continue;
                if (!dog.CanReach(bed, PathEndMode.OnCell, Danger.Deadly)) continue;
                return bed.Position;
            }

            // lugar seguro: amostra células da home area (ou ao redor), prefere longe de ameaças e coberto
            Map map = dog.Map;
            Area home = map.areaManager.Home;
            IntVec3 best = IntVec3.Invalid;
            float bestScore = float.MinValue;
            for (int i = 0; i < 60; i++)
            {
                IntVec3 c;
                if (home != null && home.TrueCount > 0)
                    c = home.ActiveCells.RandomElement();
                else if (!CellFinder.TryFindRandomCellNear(dog.Position, map, 20, x => true, out c))
                    continue;
                if (!c.Standable(map) || c.IsForbidden(dog)) continue;
                if (!dog.CanReach(c, PathEndMode.OnCell, Danger.Some)) continue;
                float score = System.Math.Min(MinThreatDist(c, threats), 40f)
                    + (c.Roofed(map) ? 8f : 0f)
                    - c.DistanceTo(dog.Position) * 0.15f;
                if (score > bestScore) { bestScore = score; best = c; }
            }
            return best;
        }

        /// <summary>Morte do Wisk: todo colono sofre; se foi morto por alguém, esse alguém vira persona non grata.</summary>
        public static void HandleDeath(Pawn dog, DamageInfo? dinfo, int goodwillPenalty)
        {
            Pawn killer = dinfo?.Instigator as Pawn;
            if (killer == dog) killer = null;
            bool friendlyFire = killer != null && killer.Faction == Faction.OfPlayer
                && dinfo.Value.Def != null && dinfo.Value.Def.isRanged; // provável bala perdida, não de propósito
            bool deliberate = killer != null && !friendlyFire;

            foreach (Pawn colonist in PawnsFinder.AllMaps_FreeColonists)
            {
                if (colonist.needs?.mood == null) continue;
                colonist.needs.mood.thoughts.memories.TryGainMemory(WiskDefOf.Wisk_Died);
                if (deliberate && colonist != killer && colonist.RaceProps.Humanlike)
                    colonist.needs.mood.thoughts.memories.TryGainMemory(WiskDefOf.Wisk_KilledWisk, killer);
            }

            if (!deliberate) return;

            if (killer.needs?.mood != null && killer.Faction == Faction.OfPlayer)
                killer.needs.mood.thoughts.memories.TryGainMemory(WiskDefOf.Wisk_IKilledWisk);

            Find.LetterStack.ReceiveLetter(
                "Wisk foi morto",
                killer.LabelShort + " matou o Wisk de propósito. Ninguém, em facção nenhuma, perdoa uma coisa dessas.",
                LetterDefOf.NegativeEvent, new LookTargets(dog.PositionHeld, dog.MapHeld));

            ApplyFactionFallout(killer.Faction, goodwillPenalty);
        }

        private static void ApplyFactionFallout(Faction killerFaction, int penalty)
        {
            if (killerFaction == null) return;
            try
            {
                if (killerFaction == Faction.OfPlayer)
                {
                    // o jogador matou: todas as facções (que não sejam inimigas) ficam horrorizadas
                    foreach (Faction f in Find.FactionManager.AllFactionsVisible)
                    {
                        if (f.IsPlayer || f.HostileTo(Faction.OfPlayer)) continue;
                        f.TryAffectGoodwillWith(Faction.OfPlayer, -penalty, true, true, null, null);
                    }
                }
                else if (!killerFaction.HostileTo(Faction.OfPlayer))
                {
                    // um aliado/neutro matou o Wisk: a relação com o jogador desaba
                    killerFaction.TryAffectGoodwillWith(Faction.OfPlayer, -penalty * 2, true, true, null, null);
                }
            }
            catch (System.Exception e)
            {
                Log.Warning("[Wisk] Falha ao aplicar a penalidade de facção: " + e.Message);
            }
        }
    }
}
