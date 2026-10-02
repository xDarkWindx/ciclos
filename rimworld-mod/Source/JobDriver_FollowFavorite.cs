using System.Collections.Generic;
using RimWorld;
using Verse;
using Verse.AI;

namespace Wisk
{
    public class JobDriver_FollowFavorite : JobDriver
    {
        private const int CheckInterval = 20;
        private const float StopDistSq = 3f * 3f;
        private const float GoDistSq = 5f * 5f;

        private Pawn Leader => job.targetA.Thing as Pawn;

        public override bool TryMakePreToilReservations(bool errorOnFailed) => true;

        protected override IEnumerable<Toil> MakeNewToils()
        {
            this.FailOn(() => !CompWisk.IsValidLeader(Leader, pawn) || !CompWisk.InHome(pawn));
            this.FailOnDowned(TargetIndex.A);

            Toil follow = new Toil();
            follow.defaultCompleteMode = ToilCompleteMode.Delay;
            follow.defaultDuration = job.expiryInterval > 0 ? job.expiryInterval : 5000;
            follow.socialMode = RandomSocialMode.Off;
            follow.tickAction = () =>
            {
                if (!pawn.IsHashIntervalTick(CheckInterval)) return;
                Pawn leader = Leader;
                float distSq = pawn.Position.DistanceToSquared(leader.Position);
                if (distSq > GoDistSq)
                {
                    if (!pawn.pather.Moving || pawn.pather.Destination.Cell.DistanceToSquared(leader.Position) > 9)
                        pawn.pather.StartPath(leader, Verse.AI.PathEndMode.Touch);
                }
                else if (distSq <= StopDistSq && pawn.pather.Moving)
                {
                    pawn.pather.StopDead();
                }
            };
            follow.AddFinishAction(() =>
            {
                CompWisk comp = pawn.TryGetComp<CompWisk>();
                if (comp != null)
                    comp.nextFollowTick = Find.TickManager.TicksGame + comp.Props.cooldownTicks.RandomInRange;
            });
            yield return follow;
        }
    }
}
