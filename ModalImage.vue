<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  getFirestore,
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  increment,
} from 'firebase/firestore'
import { getStorage, ref as fbRef, deleteObject } from 'firebase/storage'
import { getAnalytics, logEvent } from 'firebase/analytics'
import { userStore } from '@/stores/store'
import { uploadImage } from '@/api/firebase'
import { generate } from '@/api/stableDiffusion.js'
import ButtonLoading from '@/components/ButtonLoading.vue'
import Loading from '@/components/Loading.vue'

const store = userStore()
const router = useRouter()
const route = useRoute()
const emit = defineEmits(['close', 'prev', 'next', 'variation'])
const analytics = getAnalytics()

const props = defineProps({
  selectedImage: {
    type: Object,
    required: true,
  },
})

let loading = ref(false)
let upscaleLoading = ref(false)
let hasConfirmedUpscale = ref(false)
let showUpscale = ref(false)
let showConfirmDelete = ref(false)
let upscaledImage = ref('')
let startX = ref(0)
let startY = ref(0)
let endX = ref(0)
let endY = ref(0)

const hasCredits = computed(() => store.user.availableCredits > 0)
const hasSaves = computed(() => store.user.availableSaves > 0)
const imageIsUrl = computed(
  () => props.selectedImage.image && props.selectedImage.image.includes('https://')
)

const save = async () => {
  loading.value = true

  // handle analytics
  logEvent(analytics, `image saved`)

  // save image
  const imageRef = await uploadImage(props.selectedImage.image)
  const dbRef = doc(getFirestore(), store.usersCollection, store.user.id)

  // create new image object
  const newImage = {
    id: imageRef.id,
    url: imageRef.url,
    prompt: props.selectedImage.prompt || '',
    apiType: props.selectedImage.apiType || 'anime',
  }

  await updateDoc(dbRef, {
    images: arrayUnion(newImage),
    availableSaves: increment(-1),
  })

  // update state
  await store.fetchUser()

  // clear fields and close modal
  loading.value = false
}

const download = async () => {
  const a = document.createElement('a')

  if (imageIsUrl.value && !hasConfirmedUpscale.value) {
    const res = await fetch(props.selectedImage.image)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)

    a.href = url
  } else {
    a.href = hasConfirmedUpscale.value
      ? `data:image/jpeg;base64,${upscaledImage.value}`
      : `data:image/jpeg;base64,${props.selectedImage.image}`
  }

  a.download = hasConfirmedUpscale.value ? 'image_upscaled.jpg' : 'image.jpg'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)

  // handle analytics
  logEvent(analytics, `image downloaded`)
}

const deleteImage = async () => {
  loading.value = true

  try {
    const storageRef = fbRef(getStorage(), `/images/${props.selectedImage.id}`)

    // delete from storage
    await deleteObject(storageRef)

    let imageObj = {
      id: props.selectedImage.id,
      url: props.selectedImage.image,
    }

    if (props.selectedImage.apiType) {
      imageObj.apiType = props.selectedImage.apiType
    }

    if (props.selectedImage.prompt) {
      imageObj.prompt = props.selectedImage.prompt
    }

    // delete from user logos array; find then remove
    await updateDoc(doc(getFirestore(), store.usersCollection, store.user.id), {
      images: arrayRemove(imageObj),
    })

    // either fetch user again or remove from array in store
    const imageIndex = store.user.images.findIndex((x) => x.id === props.selectedImage.id)
    store.user.images.splice(imageIndex, 1)

    // handle analytics
    logEvent(analytics, `image deleted`)

    emit('close')
  } catch (err) {
    console.log(err)
  }
}

const createVariant = () => {
  store.imageVariation = props.selectedImage
  router.push('/create')
}

const upscale = async () => {
  upscaleLoading.value = true
  hasConfirmedUpscale.value = true

  let image = props.selectedImage.image

  if (imageIsUrl.value) {
    image = await convertImageToBase64()
  }

  const data = await generate(
    '',
    props.selectedImage.apiType || 'anime',
    image,
    hasCredits.value,
    null,
    true
  )

  // decrement 1 from available credits
  const dbRef = doc(getFirestore(), store.usersCollection, store.user.id)
  await updateDoc(dbRef, {
    availableCredits: increment(-1),
  })

  // update state
  await store.fetchUser()
  logEvent(analytics, `image upscaled`)

  // set image
  upscaledImage.value = data.image
  upscaleLoading.value = false
}

const convertImageToBase64 = async () => {
  const res = await fetch(props.selectedImage.image)
  const blob = await res.blob()

  return new Promise((resolve, reject) => {
    let img = new Image()

    img.onload = () => {
      let canvas = document.createElement('canvas')

      canvas.width = img.width
      canvas.height = img.height

      let ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0)

      resolve(canvas.toDataURL())
    }

    img.onerror = (err) => reject(err)

    img.src = URL.createObjectURL(blob)
  })
}

const handleKeyEvents = (e) => {
  if (e.key == 'ArrowLeft') {
    emit('prev', props.selectedImage)
  }

  if (e.key == 'ArrowRight') {
    emit('next', props.selectedImage)
  }

  if (e.key == 'Escape') {
    emit('close')
  }
}

const handleTouchStart = (e) => {
  startX.value = e.touches[0].clientX
  startY.value = e.touches[0].clientY
}

const handleTouchEnd = (e) => {
  endX.value = e.changedTouches[0].clientX
  endY.value = e.changedTouches[0].clientY

  const dx = endX.value - startX.value
  const dy = endY.value - startY.value

  if (Math.abs(dx) > Math.abs(dy)) {
    if (dx < 0) {
      // swipe left -> go next
      emit('next', props.selectedImage)
    } else {
      // swipe right -> go prev
      emit('prev', props.selectedImage)
    }
  }
}

onMounted(() => {
  // navigate with left/right keys
  document.addEventListener('keydown', handleKeyEvents)
  document.body.classList.add('overflow-hidden')
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeyEvents)
  document.body.classList.remove('overflow-hidden')
})
</script>

<template>
  <div @touchstart="handleTouchStart" @touchend="handleTouchEnd" class="modal">
    <span @click="$emit('close')" class="material-symbols-rounded close">close</span>
    <div class="img">
      <div v-if="!hasConfirmedUpscale">
        <img v-if="imageIsUrl" :src="selectedImage.image" />
        <img v-else :src="`data:image/png;base64,${selectedImage.image}`" />
      </div>
      <div v-else class="upscaled-image">
        <div v-if="upscaleLoading" class="upscale-loading">
          <h4>Upscaling image</h4>
          <p>This usually takes around 30seconds depending on server traffic.</p>
          <Loading />
        </div>
        <img v-else :src="`data:image/png;base64,${upscaledImage}`" />
      </div>
      <div v-if="!showUpscale" class="controls">
        <span
          @click="$emit('prev', selectedImage)"
          class="material-symbols-rounded prev"
          :class="{ disabled: selectedImage.index == 0 }"
        >
          navigate_before
        </span>
        <span
          @click="$emit('next', selectedImage)"
          class="material-symbols-rounded next"
          :class="{ disabled: selectedImage.index == selectedImage.savedLength - 1 }"
        >
          navigate_next
        </span>
      </div>
    </div>
    <div class="context">
      <div v-if="!showUpscale">
        <div class="info">
          <h5>Prompt</h5>
          <p>{{ selectedImage.prompt || '- old image or no prompt -' }}</p>
        </div>
        <div class="footer">
          <div v-if="route.name == 'saved'">
            <button v-if="!showConfirmDelete" @click="showConfirmDelete = true" class="delete">
              delete
            </button>
            <ButtonLoading
              v-else
              @click="deleteImage"
              text="confirm delete?"
              :loading="loading"
              class="delete"
            />
          </div>
          <button @click="download">download</button>
          <button v-if="route.name !== 'create'" @click="createVariant">variation</button>
          <button v-else @click="$emit('variation', selectedImage.image)">variation</button>
          <button @click="showUpscale = true">upscale</button>
          <ButtonLoading
            v-if="route.name !== 'saved'"
            @click="save"
            text="save"
            :disabled="!hasSaves"
            :loading="loading"
          />
        </div>
      </div>
      <div v-else>
        <div class="info">
          <h5>Upscaling</h5>
          <div v-if="!hasConfirmedUpscale">
            <p>
              Upscale your favorite images by 4x using ai! <b>Upscaling costs 1 credit</b> and
              usually completes within 20-30seconds depending on server traffic.
            </p>
            <p>
              You can currently only download upscaled images since they are 4x the size of normal
              images. Are you sure you want to upscale this image?
            </p>
          </div>
          <div v-else>
            <p>
              Excellent choice. Let us know what you think or if you have any other feature
              requests. <b>Don't forget to download!</b> If on mobile, hold down on image and save
              manually if the download button isn't working.
            </p>
            <p>
              If you haven't already, join our subreddit
              <a href="https://www.reddit.com/r/{subreddit}/" target="_blank">r/{subreddit}</a> and
              post your best images for a chance to win free credits!
            </p>
          </div>
        </div>
        <div v-if="!hasConfirmedUpscale" class="footer">
          <button @click="upscale" class="button-success" :disabled="!hasCredits">upscale</button>
          <button @click="showUpscale = false" class="button-danger">cancel</button>
        </div>
        <div v-else class="footer">
          <button @click="download" :disabled="upscaleLoading">download</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal {
  display: flex;
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  background: rgba(30, 30, 30, 0.8);
  z-index: 999;
  overflow-y: scroll;
}

.controls {
  position: absolute;
  top: calc(50% - 20px);
  right: 0;
  left: 0;
  display: flex;
  margin: auto;
}

.controls span {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 40px;
  width: 40px;
  cursor: pointer;
  background: rgba(30, 30, 30, 0.4);
  user-select: none;
  transition: 0.15s;
}

.controls span:hover {
  opacity: 0.8;
}

.prev {
  border-radius: 0 4px 4px 0;
}

.next {
  margin-left: auto;
  border-radius: 4px 0 0 4px;
}

.disabled {
  display: none !important;
}

.close {
  position: absolute;
  top: 0;
  right: 0;
  padding: 8px;
  cursor: pointer;
  transition: var(--transition);
  z-index: 9999;
}

.close:hover {
  opacity: 0.6;
}

.img {
  position: relative;
  flex-grow: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(30, 30, 30, 0.95);
}

.img img {
  height: auto;
  width: auto;
  max-height: 100vh;
}

.upscale-loading {
  text-align: center;
  padding: 0 20px;
}

.upscale-loading :deep(.loading) {
  height: 50px;
  width: 50px;
  margin-top: 16px;
}

.context {
  flex-grow: 0;
  flex-shrink: 0;
  padding: 20px;
  width: 350px;
  background: var(--color-bg);
  border-left: 2px solid rgba(30, 30, 30, 0.6);
}

.context > div {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 100%;
}

.info p {
  margin-top: 8px;
}

.info b {
  font-weight: 700;
  color: var(--color-success);
}

.info a {
  color: var(--color-success);
}

.footer {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.footer button {
  display: block;
  width: 100%;
  font-size: 14px;
}

.delete {
  background: var(--color-danger);
  border-color: var(--color-danger);
}

@media screen and (max-width: 950px) {
  .modal {
    flex-direction: column;
    overflow-x: auto;
  }

  .close {
    position: fixed;
  }

  .context {
    width: 100%;
  }

  .info p,
  .info a,
  .info b {
    font-size: 12px;
  }

  .footer {
    flex-direction: row;
    flex-wrap: wrap;
    margin-top: 24px;
    gap: 8px;
  }

  .footer button {
    width: auto;
  }

  button {
    font-size: 12px !important;
  }
}
</style>
