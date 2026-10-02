using System.Collections.Generic;
using Verse;

namespace Wisk
{
    /// <summary>Quais inimigos estão sendo provocados por qual Wisk (curta duração, não é salvo).</summary>
    public static class TauntRegistry
    {
        public const int DurationTicks = 3600;      // 1 min
        public const float MaxRange = 35f;

        private class Entry { public Pawn wisk; public int until; }
        private static readonly Dictionary<Pawn, Entry> byEnemy = new Dictionary<Pawn, Entry>();

        public static void Set(Pawn enemy, Pawn wisk)
        {
            byEnemy[enemy] = new Entry { wisk = wisk, until = Find.TickManager.TicksGame + DurationTicks };
        }

        public static void Clear(Pawn enemy) => byEnemy.Remove(enemy);

        public static void ClearForWisk(Pawn wisk)
        {
            var dead = new List<Pawn>();
            foreach (var kv in byEnemy)
                if (kv.Value.wisk == wisk) dead.Add(kv.Key);
            foreach (Pawn e in dead) byEnemy.Remove(e);
        }

        public static void Reset() => byEnemy.Clear();

        public static bool IsWiskUsable(Pawn wisk)
        {
            if (wisk == null || !wisk.Spawned || wisk.Dead || wisk.Downed) return false;
            CompWisk c = wisk.TryGetComp<CompWisk>();
            return c != null && !c.fleeRequested;
        }

        /// <summary>Retorna o Wisk que está provocando esse inimigo, se a provocação ainda vale.</summary>
        public static bool TryGet(Pawn enemy, out Pawn wisk)
        {
            wisk = null;
            if (!byEnemy.TryGetValue(enemy, out Entry e)) return false;
            if (e.until < Find.TickManager.TicksGame || enemy.Dead || enemy.Downed || !enemy.Spawned
                || !IsWiskUsable(e.wisk) || e.wisk.Map != enemy.Map)
            {
                byEnemy.Remove(enemy);
                return false;
            }
            wisk = e.wisk;
            return true;
        }

        public static bool IsTaunted(Pawn enemy) => TryGet(enemy, out _);
    }

    public class GameComponent_Wisk : GameComponent
    {
        public GameComponent_Wisk(Game game) { }
        public override void LoadedGame() => TauntRegistry.Reset();
        public override void StartedNewGame() => TauntRegistry.Reset();
    }
}
