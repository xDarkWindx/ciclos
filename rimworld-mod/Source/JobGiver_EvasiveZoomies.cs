using RimWorld;
using Verse;
using Verse.AI;

namespace Wisk
{
    /// <summary>Ameaça por perto e o Wisk inteiro: faz zoomies evasivos para distrair o atacante.</summary>
    public class JobGiver_EvasiveZoomies : ThinkNode_JobGiver
    {
        protected override Job TryGiveJob(Pawn pawn)
        {
            CompWisk comp = pawn.TryGetComp<CompWisk>();
            if (comp == null || pawn.Faction != Faction.OfPlayer || !pawn.Spawned) return null;
            if (comp.fleeRequested || pawn.Downed || pawn.InMentalState || !pawn.Awake()) return null;
            if (!pawn.DevelopmentalStage.Adult()) return null;
            if (pawn.health.summaryHealth.SummaryHealthPercent < 0.9f) return null; // ferido: não se mete

            if (!WiskUtility.ThreatNear(pawn, 30f)) return null;

            Job job = JobMaker.MakeJob(WiskDefOf.Wisk_EvasiveZoomies);
            job.locomotionUrgency = LocomotionUrgency.Sprint;
            job.expiryInterval = 2400;
            return job;
        }
    }
}
