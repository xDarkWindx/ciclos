using RimWorld;
using Verse;

namespace Wisk
{
    [DefOf]
    public static class WiskDefOf
    {
        public static JobDef Wisk_FollowFavorite;
        public static JobDef Wisk_PlayWithPet;
        public static ThoughtDef Wisk_PlayedWithPet;

        static WiskDefOf()
        {
            DefOfHelper.EnsureInitializedInCtor(typeof(WiskDefOf));
        }
    }
}
