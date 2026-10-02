using RimWorld;
using Verse;
using Verse.AI;

namespace Wisk
{
    public class JobGiver_Zoomies : ThinkNode_JobGiver
    {
        protected override Job TryGiveJob(Pawn pawn)
        {
            CompWisk comp = pawn.TryGetComp<CompWisk>();
            if (comp == null || pawn.Faction != Faction.OfPlayer || !pawn.Spawned) return null;
            if (comp.fleeRequested || Find.TickManager.TicksGame < comp.nextZoomiesTick) return null;
            if (pawn.Downed || pawn.InMentalState || !pawn.Awake() || !pawn.DevelopmentalStage.Adult()) return null;
            if (!CompWisk.InHome(pawn)) return null;

            // ferido: descansa em vez de brincar/seguir
            if (pawn.health.summaryHealth.SummaryHealthPercent < 0.9f) return null;

            Need_Food food = pawn.needs?.food;
            if (food != null && food.CurLevelPercentage < 0.5f) return null;
            Need_Rest rest = pawn.needs?.rest;
            if (rest != null && rest.CurLevelPercentage < 0.5f) return null;
            if (WiskUtility.ThreatNear(pawn, 30f)) return null;

            if (comp.zoomiesTrigger)
            {
                comp.zoomiesTrigger = false;
            }
            else if (!Rand.Chance(comp.Props.zoomiesChance))
            {
                comp.nextZoomiesTick = Find.TickManager.TicksGame + 1500;
                return null;
            }

            Job job = JobMaker.MakeJob(WiskDefOf.Wisk_Zoomies);
            job.locomotionUrgency = LocomotionUrgency.Sprint;
            job.expiryInterval = comp.Props.zoomiesTicks.RandomInRange;
            return job;
        }
    }
}
