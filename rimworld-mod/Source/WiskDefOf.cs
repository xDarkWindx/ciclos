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
        public static ThoughtDef Wisk_PlayedWithPet;
        public static ThoughtDef Wisk_WatchedZoomies;

        static WiskDefOf()
        {
            DefOfHelper.EnsureInitializedInCtor(typeof(WiskDefOf));
        }
    }
}
