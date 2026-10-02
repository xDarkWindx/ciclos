using System.Collections.Generic;
using RimWorld;
using Verse;
using Verse.AI;

namespace Wisk
{
    /// <summary>
    /// Zoomies de combate: dispara em ziguezague ao redor do inimigo mais próximo, sem chegar perto demais,
    /// para atrair a atenção. Termina quando as ameaças somem, quando leva dano (aí foge) ou por tempo.
    /// </summary>
    public class JobDriver_EvasiveZoomies : JobDriver
    {
        private const float MinSafeDist = 5f;
        private const float OrbitRadius = 11f;

        public override bool TryMakePreToilReservations(bool errorOnFailed) => true;

        protected override IEnumerable<Toil> MakeNewToils()
        {
            bool threatsGone = false;
            this.FailOn(() =>
            {
                CompWisk c = pawn.TryGetComp<CompWisk>();
                return c != null && c.fleeRequested;
            });

            Toil dash = new Toil();
            dash.defaultCompleteMode = ToilCompleteMode.Never;
            dash.socialMode = RandomSocialMode.Off;
            dash.initAction = () =>
            {
                MoteMaker.ThrowText(pawn.DrawPos, pawn.Map, "ZOOMIES!", 2f);
                PickNext();
            };
            dash.tickAction = () =>
            {
                if (pawn.IsHashIntervalTick(8))
                    FleckMaker.ThrowDustPuff(pawn.Position, pawn.Map, 0.6f);
                if (pawn.IsHashIntervalTick(60))
                    threatsGone = !WiskUtility.ThreatNear(pawn, 40f);
                if (threatsGone)
                {
                    EndJobWith(JobCondition.Succeeded);
                    return;
                }
                if (!pawn.pather.Moving || pawn.IsHashIntervalTick(50))
                    PickNext();
            };
            dash.defaultCompleteMode = ToilCompleteMode.Delay;
            dash.defaultDuration = job.expiryInterval > 0 ? job.expiryInterval : 2400;
            yield return dash;
        }

        private void PickNext()
        {
            Map map = pawn.Map;
            List<Pawn> threats = WiskUtility.Threats(pawn);
            if (threats.Count == 0) return;

            Pawn nearest = null;
            float best = float.MaxValue;
            foreach (Pawn t in threats)
            {
                float d = t.Position.DistanceToSquared(pawn.Position);
                if (d < best) { best = d; nearest = t; }
            }

            Area home = map.areaManager.Home;
            IntVec3 dest = IntVec3.Invalid;
            for (int i = 0; i < 25 && !dest.IsValid; i++)
            {
                IntVec3 c = CellFinder.RandomClosewalkCellNear(nearest.Position, map, (int)OrbitRadius);
                if (!c.IsValid || c.IsForbidden(pawn)) continue;
                if (WiskUtility.MinThreatDist(c, threats) < MinSafeDist) continue;
                if (home != null && home.TrueCount > 0 && !home[c] && i < 15) continue; // prefere ficar na home area
                if (!pawn.CanReach(c, PathEndMode.OnCell, Danger.Some)) continue;
                dest = c;
            }
            if (dest.IsValid) pawn.pather.StartPath(dest, PathEndMode.OnCell);
        }

        public override string GetReport() => "fazendo zoomies para distrair o inimigo.";
    }
}
