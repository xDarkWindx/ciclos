using System.Collections.Generic;
using HarmonyLib;
using RimWorld;
using Verse;
using Verse.AI;

namespace Wisk
{
    [StaticConstructorOnStartup]
    public static class WiskHarmony
    {
        static WiskHarmony()
        {
            new Harmony("darkwind.wisk").PatchAll();
        }
    }

    /// <summary>Inimigo provocado prefere o Wisk como alvo (a menos que ele esteja fora de alcance).</summary>
    [HarmonyPatch(typeof(AttackTargetFinder), nameof(AttackTargetFinder.BestAttackTarget))]
    public static class Patch_BestAttackTarget
    {
        public static void Postfix(IAttackTargetSearcher searcher, float maxDist, ref IAttackTarget __result)
        {
            if (!(searcher?.Thing is Pawn enemy)) return;
            if (!TauntRegistry.TryGet(enemy, out Pawn wisk)) return;
            if (wisk.Position.DistanceTo(enemy.Position) > System.Math.Min(maxDist, TauntRegistry.MaxRange)) return;
            if (!enemy.CanReach(wisk, PathEndMode.Touch, Danger.Deadly)) return;

            // é uma preferência, não um comando: a IA reavalia o alvo com frequência,
            // então basta o Wisk "estar ali" parte das vezes (se ela não achou ninguém, ele é o alvo)
            float pref = wisk.TryGetComp<CompWisk>()?.Props.tauntPreference ?? 0.5f;
            if (__result == null || Rand.Chance(pref))
                __result = wisk;
        }
    }

    public static class WiskTaunt
    {
        public static void Start(Pawn enemy, Pawn wisk)
        {
            if (!TauntRegistry.IsWiskUsable(wisk)) return;
            TauntRegistry.Set(enemy, wisk);

            Job job = JobMaker.MakeJob(WiskDefOf.Wisk_TauntOrbit, enemy);
            job.locomotionUrgency = LocomotionUrgency.Sprint;
            job.expiryInterval = TauntRegistry.DurationTicks;
            wisk.jobs.TryTakeOrderedJob(job, JobTag.Misc);

            MoteMaker.ThrowText(wisk.DrawPos, wisk.Map, "VEM PEGAR!", 2.5f);

            // faz o inimigo reavaliar o alvo já, em vez de esperar o ataque atual acabar
            if (enemy.jobs != null && enemy.CurJobDef != null && enemy.CurJobDef.defName.StartsWith("Attack"))
                enemy.jobs.EndCurrentJob(JobCondition.InterruptForced);
        }
    }
}
