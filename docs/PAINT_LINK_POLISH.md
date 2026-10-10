# Paint and Link usability polish

Paint and Link now fill the available stage after safe areas, header and controls.
Paint preserves its 32-by-32 territory rules and uses a following camera with
square cells. The player's skin remains equipped, with a contrasting outer ring
and a persistent YOU badge. Camera bounds keep the map edges visible; the badge
stays below the leaderboard. The control hint explains the player marker.

Link keeps its 6-by-6 board and stretches the row spacing to the stage height.
Touch coordinates map independently along each axis, so displayed dots and hit
targets agree in portrait and landscape. Dots are flat color discs with a subtle
depth shadow, a thin selection outline and a dark center when selected. Connections
use a narrow line with a quiet outer edge. Clears use a 140ms shrinking flash and
quick refill snap, with no particles or continuous pulsing. Effects reuse the game's existing simulation clock, freeze when
paused, expire automatically, and store at most 36 cell indices. No dependency
or additional animation loop was added. This is visual polish, not a worklet
migration of Paint or Link; their existing React simulation remains.

Validation: viewport/camera tests, Link clear/expiry/pause tests, existing motion
rules, typecheck and lint. Android emulator visual inspection confirms full-height
Paint and player badge visibility. Automated tests verify matching Link touch
positions in portrait and landscape; its animations still need a user play-through.

Manual checks: start Paint, identify YOU, swipe in all directions and close a
territory loop; follow the player near an edge. Start Link, connect neighboring
matching dots and release for a burst; close a loop for a color clear. Pause and
resume both games, and repeat on a narrow or landscape screen.

Link responsiveness follow-up: changed paths and cleared boards publish immediately
from touch input. Pointer-only updates stay in simulation without reconciliation.
Fast strokes sample the segment between events (bounded to 80 samples), including
the final lift, so intermediate dots are not skipped. Different colors and diagonal
adjacency rules remain enforced. Idle timer rendering is limited to 10Hz; clear
effects retain 60Hz publication. The board remains interactive during effects.
