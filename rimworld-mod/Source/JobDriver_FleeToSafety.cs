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
        private const int RestTicks = 7500;         // ~3 h de jogo deitado, se estiver ferido

        public override bool TryMakePreToilReservations(bool errorOnFailed) => true;

        protected override IEnumerable<Toil> MakeNewToils()
        {
            // terminou a fuga (ou foi interrompida): não repetir sem novo dano
            AddFinishAction(() =>
            {
                CompWisk c = pawn.TryGetComp<CompWisk>();
                if (c != null) c.fleeRequested = false;
            });

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
                    ReadyForNextToil(); // segue para o descanso
            };
            yield return hide;

            // ferido: fica deitado descansando antes de voltar à vida normal
            Toil rest = new Toil();
            rest.defaultCompleteMode = ToilCompleteMode.Delay;
            rest.defaultDuration = RestTicks;
            rest.socialMode = RandomSocialMode.Off;
            rest.initAction = () =>
            {
                if (pawn.health.summaryHealth.SummaryHealthPercent >= 0.9f)
                {
                    EndJobWith(JobCondition.Succeeded);
                    return;
                }
                pawn.jobs.posture = PawnPosture.LayingOnGroundNormal;
            };
            rest.tickAction = () =>
            {
                if (pawn.IsHashIntervalTick(60) && WiskUtility.ThreatNear(pawn, 12f))
                    EndJobWith(JobCondition.Succeeded);
            };
            rest.AddFinishAction(() => pawn.jobs.posture = PawnPosture.Standing);
            yield return rest;
        }

        public override string GetReport() => "fugindo para um lugar seguro.";
    }
}
