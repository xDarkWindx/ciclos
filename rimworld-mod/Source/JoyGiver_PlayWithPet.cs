using System.Collections.Generic;
using RimWorld;
using Verse;
using Verse.AI;

namespace Wisk
{
    /// <summary>Recreação: brincar com um animal que tenha CompWisk (o Papillon).</summary>
    public class JoyGiver_PlayWithPet : JoyGiver
    {
        public override Job TryGiveJob(Pawn pawn)
        {
            if (pawn.Map == null) return null;

            List<Pawn> candidates = new List<Pawn>();
            foreach (Pawn p in pawn.Map.mapPawns.SpawnedPawnsInFaction(Faction.OfPlayer))
            {
                if (p == pawn || !p.RaceProps.Animal || p.TryGetComp<CompWisk>() == null) continue;
                if (p.Downed || p.InMentalState || !p.Awake()) continue;
                if (p.IsForbidden(pawn)) continue;
                if (!pawn.CanReserveAndReach(p, PathEndMode.Touch, Danger.None)) continue;
                candidates.Add(p);
            }
            if (candidates.Count == 0) return null;

            Pawn dog = candidates.RandomElementByWeight(p =>
                pawn.relations != null && pawn.relations.DirectRelationExists(PawnRelationDefOf.Bond, p) ? 4f : 1f);
            return JobMaker.MakeJob(def.jobDef, dog);
        }
    }
}
