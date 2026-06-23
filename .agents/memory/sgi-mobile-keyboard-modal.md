---
name: SGI mobile keyboard in pageSheet modal
description: Why KeyboardAvoidingView fails in iOS pageSheet modals and the manual-tracking fix used in the battle session modal
---

# Keyboard handling inside iOS `presentationStyle="pageSheet"` modals

`KeyboardAvoidingView` (behavior="padding") does NOT reliably push content above the
keyboard when it lives inside a React Native `<Modal presentationStyle="pageSheet">`
on iOS. The sheet is not laid out like a full-screen root view, so the offset math is
wrong and the input bar stays hidden behind the keyboard.

**The fix that works:** drop `KeyboardAvoidingView` and track the keyboard manually.
- iOS only: `Keyboard.addListener("keyboardWillShow"/"keyboardWillHide")`, store
  `e.endCoordinates.height` in state, apply it as `paddingBottom` on the modal's
  `flex:1` content View. This shrinks the content and lifts the bottom input row.
- Gate the listeners to `Platform.OS === "ios"`. Android's native `adjustResize`
  already handles this; adding manual padding on Android double-adjusts.
- Input row gets safe-area bottom inset ONLY when the keyboard is hidden
  (`keyboardHeight > 0 ? 0 : insets.bottom`) so you don't stack keyboard height +
  home-indicator inset.
- Reset `keyboardHeight` to 0 in the modal's `!visible` cleanup, and call
  `Keyboard.dismiss()` when the input unmounts (e.g. battle completion) so the
  next-open / results view doesn't inherit a stale bottom gap.

**Why:** verified bug report — keyboard covered the battle message input bar; the
KeyboardAvoidingView approach had already been tried and did not fix it.

**How to apply:** any future keyboard-over-input issue inside a pageSheet/formSheet
modal in this app should use the manual-tracking pattern above, not KeyboardAvoidingView.
