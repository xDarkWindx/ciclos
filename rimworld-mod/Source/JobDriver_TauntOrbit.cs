using System.Collections.Generic;
using RimWorld;
using Verse;
using Verse.AI;

namespace Wisk
{
    /// <summary>Provocar: o Wisk corre em ziguezague em volta do inimigo escolhido, mantendo distância.</summary>
    public class JobDriver_TauntOrbit : JobDriver
    {
        private const float MinDist = 4f;
        private const int Radius = 9;

        private Pawn Enemy => job.targetA.Thing as Pawn;

        public override bool TryMakePreToilReservations(bool errorOnFailed) => true;

        protected override IEnumerable<Toil> MakeNewToils()
        {
            AddFinishAction(_ => TauntRegistry.ClearForWisk(pawn));

            this.FailOn(() =>
            {
                Pawn e = Enemy;
                if (e == null || !e.Spawned || e.Dead || e.Downed || !e.HostileTo(Faction.OfPlayer)) return true;
                CompWisk c = pawn.TryGetComp<CompWisk>();
                return c != null && c.fleeRequested;
            });

            Toil orbit = new Toil();
            orbit.defaultCompleteMode = ToilCompleteMode.Delay;
            orbit.defaultDuration = job.expiryInterval > 0 ? job.expiryInterval : TauntRegistry.DurationTicks;
            orbit.socialMode = RandomSocialMode.Off;
            orbit.initAction = PickNext;
            orbit.tickAction = () =>
            {
                if (pawn.IsHashIntervalTick(8))
                    FleckMaker.ThrowDustPuff(pawn.Position, pawn.Map, 0.6f);
                if (!pawn.pather.Moving || pawn.IsHashIntervalTick(45))
                    PickNext();
            };
            yield return orbit;
        }

        private void PickNext()
        {
            Pawn enemy = Enemy;
            if (enemy == null) return;
            Map map = pawn.Map;
            List<Pawn> threats = WiskUtility.Threats(pawn);
            Area home = map.areaManager.Home;

            IntVec3 dest = IntVec3.Invalid;
            for (int i = 0; i < 25 && !dest.IsValid; i++)
            {
                IntVec3 c = CellFinder.RandomClosewalkCellNear(enemy.Position, map, Radius);
                if (!c.IsValid || c.IsForbidden(pawn)) continue;
                if (WiskUtility.MinThreatDist(c, threats) < MinDist) continue;
                if (c.DistanceTo(enemy.Position) < MinDist + 1f) continue;
                if (home != null && home.TrueCount > 0 && !home[c] && i < 12) continue; // prefere a home area
                if (!pawn.CanReach(c, PathEndMode.OnCell, Danger.Some)) continue;
                dest = c;
            }
            if (dest.IsValid) pawn.pather.StartPath(dest, PathEndMode.OnCell);
        }

        public override string GetReport() => "provocando " + (Enemy?.LabelShort ?? "o inimigo") + ".";
    }
}
