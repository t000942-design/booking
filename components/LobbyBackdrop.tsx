/**
 * Modern aurora-style backdrop used by the post-login customer pages
 * (/book, /pay/[ref], /booking/[ref]). Sits at z-index 0 and overlays the
 * default .pitch-bg field that's set by the (public) layout, so signed-in
 * customers see a different, calmer look than the sign-in screen.
 */
export function LobbyBackdrop() {
  return (
    <>
      <div className="lobby-bg" aria-hidden />
      <div className="lobby-bg-dots" aria-hidden />
    </>
  );
}
