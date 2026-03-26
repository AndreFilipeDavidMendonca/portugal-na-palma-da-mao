User menu style patch

What changed
- Introduced shared user-menu mixins in src/styles/base.scss
- Unified dropdown and flyout shell visuals
- Unified header/avatar styling
- Unified list-card surfaces for favorites, friends, and notifications
- Unified round action buttons for chat / accept / reject / delete
- Smoothed top-right user menu button hover/focus styling

Files included
- src/styles/base.scss
- src/features/topbar/UserMenu/UserMenu.scss
- src/features/topbar/UserMenu/Components/shared/UserMenuFlyout.scss
- src/features/topbar/UserMenu/Components/UserMenuDropdown/UserMenuDropdown.scss
- src/features/topbar/UserMenu/Components/UserMenuHeader/UserMenuHeader.scss
- src/features/topbar/UserMenu/Components/FriendsFlyout/FriendsFlyout.scss
- src/features/topbar/UserMenu/Components/NotificationsFlyout/NotificationsFlyout.scss

Notes
- FavoritesFlyout.scss and MyPoisFlyout.scss were left untouched because they already inherit the shared flyout stylesheet.
- This patch is style-focused. No TSX logic changes were included.
