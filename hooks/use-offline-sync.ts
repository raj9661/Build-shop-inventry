"use client"

import { useState, useEffect } from "react"
import localforage from "localforage"

export function useOfflineSync<T>(storageKey: string, syncFunction: (data: T) => Promise<any>) {
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    const updateOnlineStatus = () => {
      setIsOnline(navigator.onLine)
    }

    window.addEventListener("online", updateOnlineStatus)
    window.addEventListener("offline", updateOnlineStatus)
    updateOnlineStatus()

    return () => {
      window.removeEventListener("online", updateOnlineStatus)
      window.removeEventListener("offline", updateOnlineStatus)
    }
  }, [])

  useEffect(() => {
    const syncData = async () => {
      if (isOnline) {
        console.log("Online. Attempting to sync data...")
        const offlineData: T[] | null = await localforage.getItem(storageKey)
        if (offlineData && offlineData.length > 0) {
          console.log(`Found ${offlineData.length} items in ${storageKey} to sync.`)
          for (const item of offlineData) {
            try {
              await syncFunction(item)
            } catch (error) {
              console.error("Sync failed for item:", item, error)
              // Decide on error handling: retry, or keep in local storage
            }
          }
          // Clear storage after successful sync
          await localforage.removeItem(storageKey)
          console.log(`Sync complete for ${storageKey}. Cleared local storage.`)
        }
      }
    }

    syncData()
  }, [isOnline, storageKey, syncFunction])

  const saveData = async (data: T) => {
    if (isOnline) {
      try {
        await syncFunction(data)
        console.log("Data synced to server immediately.")
      } catch (error) {
        console.error("Immediate sync failed, saving locally.", error)
        await saveLocally(data)
      }
    } else {
      await saveLocally(data)
    }
  }

  const saveLocally = async (data: T) => {
    console.log("Offline. Saving data locally.")
    const offlineData: T[] | null = await localforage.getItem(storageKey)
    const newData = offlineData ? [...offlineData, data] : [data]
    await localforage.setItem(storageKey, newData)
  }

  return { saveData, isOnline }
}
