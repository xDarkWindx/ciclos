using RimWorld;
using Verse;

namespace Wisk
{
    public class CompProperties_Wisk : CompProperties
    {
        // chance de começar a seguir a cada vez que o animal fica ocioso (0..1)
        public float followChance = 0.4f;
        public IntRange followTicks = new IntRange(3750, 7500);      // ~1,5h a 3h de jogo
        public IntRange cooldownTicks = new IntRange(5000, 12000);

        public CompProperties_Wisk()
        {
            compClass = typeof(CompWisk);
        }
    }

    /// <summary>Guarda o cooldown do "seguir o favorito" e acha quem é o favorito.</summary>
    public class CompWisk : ThingComp
    {
        public int nextFollowTick;

        public CompProperties_Wisk Props => (CompProperties_Wisk)props;

        public override void PostExposeData()
        {
            Scribe_Values.Look(ref nextFollowTick, "nextFollowTick");
        }

        public static bool InHome(Pawn p)
        {
            Map map = p.MapHeld;
            if (map == null) return false;
            Area home = map.areaManager.Home;
            return home != null && home.TrueCount > 0 && home[p.PositionHeld];
        }

        public static bool IsValidLeader(Pawn leader, Pawn dog)
        {
            return leader != null
                && leader.Spawned
                && leader.Map == dog.Map
                && leader.IsColonist
                && !leader.Dead && !leader.Downed && !leader.Drafted
                && leader.Awake()
                && !leader.InBed()
                && !leader.InMentalState
                && InHome(leader);
        }

        /// <summary>Favorito: pawn com vínculo (bond) → dono (master) → colono mais próximo.</summary>
        public static Pawn FindFavorite(Pawn dog)
        {
            Pawn bonded = dog.relations?.GetFirstDirectRelationPawn(PawnRelationDefOf.Bond, p => IsValidLeader(p, dog));
            if (bonded != null) return bonded;

            Pawn master = dog.playerSettings?.Master;
            if (IsValidLeader(master, dog)) return master;

            Pawn closest = null;
            float best = float.MaxValue;
            foreach (Pawn p in dog.Map.mapPawns.FreeColonistsSpawned)
            {
                if (!IsValidLeader(p, dog)) continue;
                float d = p.Position.DistanceToSquared(dog.Position);
                if (d < best) { best = d; closest = p; }
            }
            return closest;
        }
    }
}
