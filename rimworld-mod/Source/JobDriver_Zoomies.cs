using System.Collections.Generic;
using RimWorld;
using Verse;
using Verse.AI;

namespace Wisk
{
    /// <summary>Corrida maluca pela home area. Colonos que veem ficam mais felizes.</summary>
    public class JobDriver_Zoomies : JobDriver
    {
        public override bool TryMakePreToilReservations(bool errorOnFailed) => true;

        protected override IEnumerable<Toil> MakeNewToils()
        {
            this.FailOn(() =>
            {
                CompWisk c = pawn.TryGetComp<CompWisk>();
                return c != null && c.fleeRequested;
            });
            bool threat = false;
            this.FailOn(() =>
            {
                if (pawn.IsHashIntervalTick(30)) threat = WiskUtility.ThreatNear(pawn, 25f);
                return threat;
            });

            Toil run = new Toil();
            run.defaultCompleteMode = ToilCompleteMode.Delay;
            run.defaultDuration = job.expiryInterval > 0 ? job.expiryInterval : 1200;
            run.socialMode = RandomSocialMode.Off;
            run.initAction = () =>
            {
                foreach (Pawn p in pawn.Map.mapPawns.FreeColonistsSpawned)
                {
                    if (p.Position.InHorDistOf(pawn.Position, 14f) && GenSight.LineOfSight(p.Position, pawn.Position, pawn.Map)
                        && p.needs?.mood != null)
                        p.needs.mood.thoughts.memories.TryGainMemory(WiskDefOf.Wisk_WatchedZoomies, pawn);
                }
                MoteMaker.ThrowText(pawn.DrawPos, pawn.Map, "ZOOMIES!", 2f);
                PickNext();
            };
            run.tickAction = () =>
            {
                if (pawn.IsHashIntervalTick(8))
                    FleckMaker.ThrowDustPuff(pawn.Position, pawn.Map, 0.6f);
                if (!pawn.pather.Moving || pawn.IsHashIntervalTick(90))
                    PickNext();
            };
            run.AddFinishAction(() =>
            {
                CompWisk comp = pawn.TryGetComp<CompWisk>();
                if (comp != null)
                    comp.nextZoomiesTick = Find.TickManager.TicksGame + comp.Props.zoomiesCooldownTicks.RandomInRange;
            });
            yield return run;
        }

        private void PickNext()
        {
            Area home = pawn.Map.areaManager.Home;
            IntVec3 c = CellFinder.RandomClosewalkCellNear(pawn.Position, pawn.Map, 12,
                x => home == null || home.TrueCount == 0 || home[x]);
            if (c.IsValid) pawn.pather.StartPath(c, PathEndMode.OnCell);
        }

        public override string GetReport() => "correndo de felicidade (zoomies).";
    }
}
