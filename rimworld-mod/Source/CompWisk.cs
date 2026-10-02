using RimWorld;
using Verse;
using Verse.AI;

namespace Wisk
{
    public class CompProperties_Wisk : CompProperties
    {
        // seguir o favorito
        public float followChance = 0.4f;
        public IntRange followTicks = new IntRange(3750, 7500);      // ~1,5h a 3h de jogo
        public IntRange cooldownTicks = new IntRange(5000, 12000);

        // zoomies
        public float zoomiesChance = 0.12f;
        public IntRange zoomiesTicks = new IntRange(900, 1800);      // 15 a 30 s
        public IntRange zoomiesCooldownTicks = new IntRange(20000, 40000);

        // agilidade: esquiva de tiros (corpo a corpo é pelo stat MeleeDodgeChance)
        public float rangedDodgeChance = 0.9f;                       // 90% dos tiros "erram"

        // consequências de matar
        public int killerGoodwillPenalty = 40;                       // facção do assassino perde isso com as outras

        public CompProperties_Wisk()
        {
            compClass = typeof(CompWisk);
        }
    }

    /// <summary>Estado e regras do Wisk: favorito, zoomies, esquiva de tiros e fuga ao tomar dano.</summary>
    public class CompWisk : ThingComp
    {
        public int nextFollowTick;
        public int nextZoomiesTick;
        public bool zoomiesTrigger;
        public bool fleeRequested;
        public int lastDamageTick = -99999;
        private int nextFleeTryTick;

        public CompProperties_Wisk Props => (CompProperties_Wisk)props;

        public override void PostExposeData()
        {
            Scribe_Values.Look(ref nextFollowTick, "nextFollowTick");
            Scribe_Values.Look(ref nextZoomiesTick, "nextZoomiesTick");
            Scribe_Values.Look(ref zoomiesTrigger, "zoomiesTrigger");
            Scribe_Values.Look(ref fleeRequested, "fleeRequested");
            Scribe_Values.Look(ref lastDamageTick, "lastDamageTick", -99999);
        }

        // ---- esquiva de tiros (corpo a corpo é pelo stat MeleeDodgeChance no XML) ----
        public override void PostPreApplyDamage(ref DamageInfo dinfo, out bool absorbed)
        {
            absorbed = false;
            Pawn pawn = parent as Pawn;
            if (pawn == null || pawn.Dead) return;
            DamageDef def = dinfo.Def;
            if (def != null && def.isRanged && !def.isExplosive && Rand.Chance(Props.rangedDodgeChance))
            {
                absorbed = true;
                if (pawn.Spawned)
                    MoteMaker.ThrowText(pawn.DrawPos, pawn.Map, "errou!", 1.5f);
                return;
            }
        }

        // ---- morte: consequências ----
        public override void Notify_Killed(Map prevMap, DamageInfo? dinfo = null)
        {
            Pawn dog = parent as Pawn;
            if (dog == null) return;
            WiskUtility.HandleDeath(dog, dinfo, Props.killerGoodwillPenalty);
        }

        // ---- qualquer dano que passar → foge ----
        public override void PostPostApplyDamage(DamageInfo dinfo, float totalDamageDealt)
        {
            Pawn pawn = parent as Pawn;
            if (pawn == null || pawn.Dead || totalDamageDealt <= 0f) return;
            fleeRequested = true;
            lastDamageTick = Find.TickManager.TicksGame;
        }

        public override void CompTick() => DoTick();

        public override void CompTickInterval(int delta) => DoTick();

        private void DoTick()
        {
            Pawn pawn = parent as Pawn;
            if (pawn == null || !pawn.Spawned || pawn.Dead) return;
            CheckFlee(pawn);
        }

        private void CheckFlee(Pawn pawn)
        {
            if (!fleeRequested) return;
            if (pawn.Downed) return;
            if (pawn.CurJobDef == WiskDefOf.Wisk_FleeToSafety) return;
            int now = Find.TickManager.TicksGame;
            if (now < nextFleeTryTick) return;
            nextFleeTryTick = now + 30;
            // reavalia a árvore de pensamento; o JobGiver_FleeToSafety vem primeiro
            pawn.jobs.EndCurrentJob(JobCondition.InterruptForced);
        }

        // ---- favorito ----
        public static bool InHome(Pawn p)
        {
            Map map = p.MapHeld;
            if (map == null) return false;
            Area home = map.areaManager.Home;
            return home != null && home.TrueCount > 0 && home[p.PositionHeld];
        }

        public static bool IsValidLeader(Pawn leader, Pawn dog)
        {
            return leader != null
                && leader.Spawned
                && leader.Map == dog.Map
                && leader.IsColonist
                && !leader.Dead && !leader.Downed && !leader.Drafted
                && leader.Awake()
                && !leader.InBed()
                && !leader.InMentalState
                && InHome(leader);
        }

        /// <summary>Pawn com vínculo (bond) ou dono (master), esteja onde estiver.</summary>
        public static Pawn FindBondOrMaster(Pawn dog)
        {
            Pawn bonded = dog.relations?.GetFirstDirectRelationPawn(PawnRelationDefOf.Bond);
            if (bonded != null && !bonded.Dead) return bonded;
            return dog.playerSettings?.Master;
        }

        /// <summary>Favorito: vínculo → dono → colono mais próximo (precisa estar disponível e na home area).</summary>
        public static Pawn FindFavorite(Pawn dog)
        {
            Pawn bonded = dog.relations?.GetFirstDirectRelationPawn(PawnRelationDefOf.Bond, p => IsValidLeader(p, dog));
            if (bonded != null) return bonded;

            Pawn master = dog.playerSettings?.Master;
            if (IsValidLeader(master, dog)) return master;

            Pawn closest = null;
            float best = float.MaxValue;
            foreach (Pawn p in dog.Map.mapPawns.FreeColonistsSpawned)
            {
                if (!IsValidLeader(p, dog)) continue;
                float d = p.Position.DistanceToSquared(dog.Position);
                if (d < best) { best = d; closest = p; }
            }
            return closest;
        }
    }
}
