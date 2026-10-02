using RimWorld;
using Verse;

namespace Wisk
{
    [DefOf]
    public static class WiskDefOf
    {
        public static JobDef Wisk_FollowFavorite;
        public static JobDef Wisk_PlayWithPet;
        public static JobDef Wisk_FleeToSafety;
        public static JobDef Wisk_Zoomies;
        public static JobDef Wisk_EvasiveZoomies;
        public static JobDef Wisk_TauntOrbit;
        public static ThoughtDef Wisk_PlayedWithPet;
        public static ThoughtDef Wisk_WatchedZoomies;
        public static ThoughtDef Wisk_Died;
        public static ThoughtDef Wisk_KilledWisk;
        public static ThoughtDef Wisk_IKilledWisk;

        static WiskDefOf()
        {
            DefOfHelper.EnsureInitializedInCtor(typeof(WiskDefOf));
        }
    }
}
