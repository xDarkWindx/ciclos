using System.Collections.Generic;
using RimWorld;
using Verse;
using Verse.AI;

namespace Wisk
{
    public class JobDriver_PlayWithPet : JobDriver
    {
        private Pawn Dog => (Pawn)job.targetA.Thing;

        public override bool TryMakePreToilReservations(bool errorOnFailed) =>
            pawn.Reserve(Dog, job, 1, -1, null, errorOnFailed);

        protected override IEnumerable<Toil> MakeNewToils()
        {
            this.FailOnDespawnedOrNull(TargetIndex.A);
            this.FailOn(() => Dog.Downed || Dog.InMentalState);

            yield return Toils_Goto.GotoThing(TargetIndex.A, PathEndMode.Touch);

            Toil play = new Toil();
            play.initAction = () =>
            {
                // segura o cachorro no lugar enquanto brincam
                Dog.jobs.StopAll();
                Dog.pather.StopDead();
                Job wait = JobMaker.MakeJob(JobDefOf.Wait, job.def.joyDuration + 60);
                Dog.jobs.StartJob(wait, JobCondition.InterruptForced);
            };
            play.tickAction = () =>
            {
                pawn.rotationTracker.FaceTarget(Dog);
                Dog.rotationTracker.FaceTarget(pawn);
                if (pawn.IsHashIntervalTick(120))
                    FleckMaker.ThrowMetaIcon(Dog.Position, Dog.Map, FleckDefOf.Heart);
                JoyUtility.JoyTickCheckEnd(pawn, 1);
            };
            play.defaultCompleteMode = ToilCompleteMode.Delay;
            play.defaultDuration = job.def.joyDuration;
            play.socialMode = RandomSocialMode.Off;
            play.AddFinishAction(() =>
            {
                if (Dog != null && Dog.CurJobDef == JobDefOf.Wait)
                    Dog.jobs.EndCurrentJob(JobCondition.Succeeded);
                if (ticksSpent())
                {
                    if (pawn.needs?.mood != null)
                        pawn.needs.mood.thoughts.memories.TryGainMemory(WiskDefOf.Wisk_PlayedWithPet, Dog);
                    CompWisk comp = Dog?.TryGetComp<CompWisk>();
                    if (comp != null && Rand.Chance(0.35f))
                    {
                        comp.zoomiesTrigger = true;
                        comp.nextZoomiesTick = Find.TickManager.TicksGame + 120;
                    }
                }
            });
            yield return play;
        }

        // só dá o pensamento se brincou por um tempo razoável
        private bool ticksSpent() => job.startTick >= 0 && Find.TickManager.TicksGame - job.startTick > 300;
    }
}
