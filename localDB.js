import { get, set, clear } from 'idb-keyval'

const key = 'images'

export const updateHistory = async (batch) => {
  try {
    const history = await get(key)
    let images = batch.images.map((x) => ({
      image: x,
      prompt: batch.prompt,
      apiType: batch.apiType || 'anime',
    }))

    // if history exists, add new images to the front
    if (history) {
      images = images.concat(history)
    }

    // only save last 25 images, if longer remove last 4 (number of new images)
    images.splice(25)

    await set(key, images)
  } catch (err) {
    console.log(err)
  }
}

export const fetchHistory = async () => {
  try {
    return await get(key)
  } catch (err) {
    console.log(err)
  }
}

export const clearHistory = async () => {
  await clear()
}
