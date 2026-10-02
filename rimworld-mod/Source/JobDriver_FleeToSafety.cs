using System.Collections.Generic;
using RimWorld;
using Verse;
using Verse.AI;

namespace Wisk
{
    public class JobDriver_FleeToSafety : JobDriver
    {
        private const int MinHideTicks = 900;       // sem dano por 15 s
        private const int MaxHideTicks = 7500;

        public override bool TryMakePreToilReservations(bool errorOnFailed) => true;

        protected override IEnumerable<Toil> MakeNewToils()
        {
            yield return Toils_Goto.GotoCell(TargetIndex.A, PathEndMode.OnCell);

            Toil hide = new Toil();
            int started = 0;
            hide.defaultCompleteMode = ToilCompleteMode.Never;
            hide.socialMode = RandomSocialMode.Off;
            hide.initAction = () =>
            {
                started = Find.TickManager.TicksGame;
                pawn.pather.StopDead();
            };
            hide.tickAction = () =>
            {
                if (!pawn.IsHashIntervalTick(30)) return;
                CompWisk comp = pawn.TryGetComp<CompWisk>();
                int now = Find.TickManager.TicksGame;
                bool calm = comp == null || now - comp.lastDamageTick > MinHideTicks;
                if ((calm && !WiskUtility.ThreatNear(pawn, 20f)) || now - started > MaxHideTicks)
                    EndJobWith(JobCondition.Succeeded);
            };
            yield return hide;
        }

        public override string GetReport() => "fugindo para um lugar seguro.";
    }
}
