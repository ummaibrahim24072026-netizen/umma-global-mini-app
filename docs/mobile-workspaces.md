# Phone and tablet workspaces

The staff app uses four clearly named sections: Courier, Kitchen, Cashier and Staff. Existing role permissions still decide which sections a person sees.

On phones up to 650 px, icon-and-label navigation stays at the bottom, with safe-area spacing. The cashier shortcut sits above navigation; forms and page content include bottom clearance. Navigation and the shortcut hide when a focused field and the Visual Viewport indicate an open keyboard. Inputs use 16 px text and primary controls have 48–56 px touch targets. Staff invitation links can be copied with one tap; unsupported clipboard access has an explicit fallback.

Tablets retain top navigation. Portrait layouts use stacked content, while 900–1100 px landscape tablets show the product catalogue beside a 320 px cart. Kitchen cards and courier tasks wrap to available width without changing the workflow.

Validation: standalone cashier/courier/auth tests passed. Synthetic fixtures exercise staff invitations/copy, keyboard focus/resize restoration, section filters and cart shortcuts. Browser geometry checks covered all four sections at 320, 390, 768, 1024 and 1280 px: controls stayed inside the viewport, button text was not clipped, bottom navigation remained at the phone viewport edge, and the cashier shortcut did not intersect navigation. The fixture data is synthetic; no real staff invitations, orders or payments are created by these checks.
