using RimWorld;
using Verse;
using Verse.AI;

namespace Wisk
{
    public class JobGiver_FleeToSafety : ThinkNode_JobGiver
    {
        protected override Job TryGiveJob(Pawn pawn)
        {
            CompWisk comp = pawn.TryGetComp<CompWisk>();
            if (comp == null || !comp.fleeRequested || !pawn.Spawned) return null;

            // dano antigo e sem ameaça por perto: esquece
            if (Find.TickManager.TicksGame - comp.lastDamageTick > 1800 && !WiskUtility.ThreatNear(pawn, 20f))
            {
                comp.fleeRequested = false;
                return null;
            }

            IntVec3 dest = WiskUtility.FindRefuge(pawn);
            if (!dest.IsValid)
            {
                comp.fleeRequested = false;
                return null;
            }

            Job job = JobMaker.MakeJob(WiskDefOf.Wisk_FleeToSafety, dest);
            job.locomotionUrgency = LocomotionUrgency.Sprint;
            job.playerForced = true; // não deixa outros givers atravessarem a fuga
            return job;
        }
    }
}
