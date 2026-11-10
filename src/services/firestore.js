// src/services/firestore.js
// All Firestore playlist operations, isolated so components stay clean.
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  onSnapshot, serverTimestamp, query, orderBy, arrayUnion, arrayRemove,
} from 'firebase/firestore'
import { db } from './firebase'

/** Returns the playlists sub-collection ref for a user. */
const playlistsRef = (uid) => collection(db, 'users', uid, 'playlists')

/** Returns a single playlist doc ref. */
const playlistRef = (uid, playlistId) => doc(db, 'users', uid, 'playlists', playlistId)

/**
 * Subscribe to all playlists for a user (real-time).
 * @param {string} uid
 * @param {(playlists: object[]) => void} onData
 * @returns unsubscribe function
 */
export function subscribeToPlaylists(uid, onData) {
  const q = query(playlistsRef(uid), orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snap) => {
    const playlists = snap.docs.map((d) => ({ id: d.id, ...d.data(), tracks: d.data().tracks ?? [] }))
    onData(playlists)
  })
}

export async function createPlaylist(uid, name) {
  const ref = await addDoc(playlistsRef(uid), {
    name,
    tracks: [],
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function renamePlaylist(uid, playlistId, name) {
  await updateDoc(playlistRef(uid, playlistId), { name })
}

export async function deletePlaylist(uid, playlistId) {
  await deleteDoc(playlistRef(uid, playlistId))
}

/**
 * Add a track to a playlist.
 * track = { id, title, artist, thumbnail }
 */
export async function addTrackToPlaylist(uid, playlistId, track) {
  // arrayUnion is a no-op if an object with same identity already exists;
  // we deduplicate by id on the client side in AccountContext.
  await updateDoc(playlistRef(uid, playlistId), {
    tracks: arrayUnion(track),
  })
}

/**
 * Remove a track from a playlist by its youtube video id.
 */
export async function removeTrackFromPlaylist(uid, playlistId, track) {
  await updateDoc(playlistRef(uid, playlistId), {
    tracks: arrayRemove(track),
  })
}
