# Melojam UI/UX improvements

Applied from the ui-ux suite (dialog, active, passive) and the accessibility review.

## Drop-in files (same paths as your project)

| File | What changed |
|---|---|
| `src/hooks/useDialog.js` | **New.** Focus moves into the dialog, Tab stays inside, Escape closes (topmost dialog only), focus returns to the opener. |
| `src/components/Toasts.jsx` | **New.** `ToastProvider` and `useToast()`. Live region, 10 s minimum, pauses on hover/focus, closable, optional Undo button, never steals focus. |
| `src/styles/components/feedback.css` | **New.** Toast styles, stacked full-width dialog buttons on phones, invalid-field border. |
| `src/main.jsx` | Wraps the app in `ToastProvider`. |
| `src/components/ConfirmModal.jsx` | Cancel (the safe action) gets initial focus. Escape and outside click are blocked while busy. |
| `src/components/FeedbackModal.jsx` | Focus trap and focus return. Decorative icon hidden from screen readers. |
| `src/components/AuthModal.jsx` | One autofocus only (it had two). Outside click no longer discards typed input. Required and min-length on fields, `aria-invalid` and `aria-describedby` on error. Error clears when switching Log in / Sign up. |
| `src/components/InviteFriendsModal.jsx` | Focus trap. Buttons say who they invite (`Invite @name`). Fixed the stale "Friends page" wording to match Settings. |

## One line to add

In `src/styles/index.css`, after `@import './components/skeleton.css';` add:

```css
@import './components/feedback.css';
```

## Optional: Undo instead of silent removal (action.undo)

Removing a single song from the queue currently has no way back. These two edits add an Undo toast.

### `src/components/MusicRoom.jsx`

Add the imports:

```js
import { useToast } from './Toasts'
```

Inside `MusicRoom`, next to the other hooks:

```js
const toast = useToast()
```

Replace `removeTrack` with:

```js
const removeTrack = (index) => {
  const removed = room.queue[index]
  if (!removed) return
  updateRoom((state) => {
    const queue = state.queue.filter((_, itemIndex) => itemIndex !== index)
    const current = queue.length ? Math.min(state.current > index ? state.current - 1 : state.current, queue.length - 1) : 0
    return { ...state, queue, current, playing: queue.length ? state.playing : false }
  })
  toast.show({
    message: `Removed “${removed.title}” from the queue`,
    actionLabel: 'Undo',
    onAction: () => updateRoom((state) => {
      if (state.queue.some((item) => item.id === removed.id)) return state
      const queue = [...state.queue]
      const at = Math.min(index, queue.length)
      queue.splice(at, 0, removed)
      const current = queue.length === 1 ? 0 : (at <= state.current ? state.current + 1 : state.current)
      return { ...state, queue, current }
    }),
  })
}
```

### `src/components/PersistentPlayer.jsx`

Same idea. Add `import { useToast } from './Toasts'`, then `const toast = useToast()` near the other hooks, and replace `removeTrack` with:

```js
const removeTrack = useCallback((index) => {
  const removed = playbackQueue[index]
  if (!removed) return
  onPlaybackChange((state) => {
    const queue = state.queue.filter((_, itemIndex) => itemIndex !== index)
    const current = queue.length ? Math.min(state.current > index ? state.current - 1 : state.current, queue.length - 1) : 0
    return { ...state, queue, current, playing: queue.length ? state.playing : false }
  })
  toast.show({
    message: `Removed “${removed.title}” from the queue`,
    actionLabel: 'Undo',
    onAction: () => onPlaybackChange((state) => {
      if (state.queue.some((item) => item.id === removed.id)) return state
      const queue = [...state.queue]
      const at = Math.min(index, queue.length)
      queue.splice(at, 0, removed)
      const current = queue.length === 1 ? 0 : (at <= state.current ? state.current + 1 : state.current)
      return { ...state, queue, current }
    }),
  })
}, [onPlaybackChange, playbackQueue, toast])
```

If you undo the removal of the song that was playing, it returns to its place in the queue but does not start playing again.

## Findings I did not change (your call)

| Area | Finding | Suggested fix |
|---|---|---|
| Settings, Delete account | Typing `DELETE` is the only gate for something permanent. That is fine for a catastrophic action, but Google-only accounts are never asked to re-authenticate. | Add a Google re-auth step in `deleteAccount`. |
| Playlists, Delete playlist | Confirm dialog does not say how many songs are lost. | Message: "Delete “Name”? Its 24 songs will be removed." |
| Queue, Remove all tracks | Same: the dialog does not say how many songs. | Pass the count into the message. |
| Muted text | `--muted` on `--surface` in light mode is close to the 4.5:1 limit at 11 to 12 px sizes. | Darken `--muted` a little or raise the smallest text to 13 px. Verify with a contrast checker. |
| Landmarks | No skip link, and pages use `<main>` inside the scrolling shell only. | Add a "Skip to content" link as the first element in `Shell`. |

I have not run an automated scan or a screen reader pass. Please check these changes with axe and a keyboard walkthrough before calling the app accessible.