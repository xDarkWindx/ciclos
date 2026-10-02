using RimWorld;
using Verse;
using Verse.AI;

namespace Wisk
{
    public class JobGiver_FollowFavorite : ThinkNode_JobGiver
    {
        protected override Job TryGiveJob(Pawn pawn)
        {
            CompWisk comp = pawn.TryGetComp<CompWisk>();
            if (comp == null || pawn.Faction != Faction.OfPlayer || !pawn.Spawned) return null;
            if (Find.TickManager.TicksGame < comp.nextFollowTick) return null;
            if (pawn.Downed || pawn.InMentalState || !pawn.Awake() || !pawn.DevelopmentalStage.Adult()) return null;
            if (!CompWisk.InHome(pawn)) return null;

            // deixa o instinto básico ganhar: fome e cansaço
            // ferido: descansa em vez de brincar/seguir
            if (pawn.health.summaryHealth.SummaryHealthPercent < 0.9f) return null;

            Need_Food food = pawn.needs?.food;
            if (food != null && food.CurLevelPercentage < 0.35f) return null;
            Need_Rest rest = pawn.needs?.rest;
            if (rest != null && rest.CurLevelPercentage < 0.3f) return null;

            if (!Rand.Chance(comp.Props.followChance))
            {
                comp.nextFollowTick = Find.TickManager.TicksGame + 600;
                return null;
            }

            Pawn favorite = CompWisk.FindFavorite(pawn);
            if (favorite == null) return null;

            Job job = JobMaker.MakeJob(WiskDefOf.Wisk_FollowFavorite, favorite);
            job.expiryInterval = comp.Props.followTicks.RandomInRange;
            return job;
        }
    }
}
