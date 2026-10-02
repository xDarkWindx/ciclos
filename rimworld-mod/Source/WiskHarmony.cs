using System.Collections.Generic;
using HarmonyLib;
using RimWorld;
using UnityEngine;
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
            __result = wisk;
        }
    }

    /// <summary>Botão "Provocar com o Wisk" ao selecionar um pawn inimigo.</summary>
    [HarmonyPatch(typeof(Pawn), nameof(Pawn.GetGizmos))]
    public static class Patch_PawnGizmos
    {
        public static IEnumerable<Gizmo> Postfix(IEnumerable<Gizmo> __result, Pawn __instance)
        {
            foreach (Gizmo g in __result) yield return g;
            Gizmo taunt = WiskTaunt.GizmoFor(__instance);
            if (taunt != null) yield return taunt;
        }
    }

    public static class WiskTaunt
    {
        private static Texture2D icon;
        private static Texture2D Icon =>
            icon ?? (icon = ContentFinder<Texture2D>.Get("Things/Pawn/Animal/Papillon/Papillon_south", false) ?? BaseContent.BadTex);

        public static Gizmo GizmoFor(Pawn enemy)
        {
            if (enemy == null || !enemy.Spawned || enemy.Dead || enemy.Downed) return null;
            if (enemy.Faction == Faction.OfPlayer || enemy.IsPrisonerOfColony || !enemy.HostileTo(Faction.OfPlayer)) return null;

            Pawn any = null, best = null;
            float bestDist = float.MaxValue;
            foreach (Pawn p in enemy.Map.mapPawns.SpawnedPawnsInFaction(Faction.OfPlayer))
            {
                if (p.TryGetComp<CompWisk>() == null) continue;
                any = p;
                if (!TauntRegistry.IsWiskUsable(p) || p.health.summaryHealth.SummaryHealthPercent < 0.9f) continue;
                float d = p.Position.DistanceToSquared(enemy.Position);
                if (d < bestDist) { bestDist = d; best = p; }
            }
            if (any == null) return null; // sem Wisk no mapa, sem botão

            if (TauntRegistry.IsTaunted(enemy))
            {
                return new Command_Action
                {
                    defaultLabel = "Parar provocação",
                    defaultDesc = "O Wisk para de provocar esse inimigo.",
                    icon = Icon,
                    action = () =>
                    {
                        if (TauntRegistry.TryGet(enemy, out Pawn w))
                            w.jobs.EndCurrentJob(JobCondition.InterruptForced);
                        TauntRegistry.Clear(enemy);
                    }
                };
            }

            var cmd = new Command_Action
            {
                defaultLabel = "Provocar com o Wisk",
                defaultDesc = "O Wisk corre em volta desse inimigo e o faz preferir persegui-lo. Termina se o Wisk for ferido, se o inimigo cair ou depois de 1 minuto.",
                icon = Icon,
                action = () => Start(enemy, best)
            };
            if (best == null)
                cmd.Disable("O Wisk está ferido ou ocupado fugindo.");
            else if (best.Position.DistanceTo(enemy.Position) > TauntRegistry.MaxRange * 2f)
                cmd.Disable("O Wisk está longe demais.");
            return cmd;
        }

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
