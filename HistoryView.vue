<script setup>
import { ref, onMounted } from 'vue'
import { fetchHistory, clearHistory } from '@/utilities/localDB.js'
import PageTitle from '@/components/PageTitle.vue'
import ModalImage from '@/components/ModalImage.vue'

let images = ref([])
let showClearConfirm = ref(false)
let showModalImage = ref(false)
let selectedImage = ref({})

const clear = async () => {
  await clearHistory()
  images.value = []
}

const showImage = (item, index) => {
  selectedImage.value = {
    image: item.image,
    prompt: item.prompt || '',
    apiType: item.apiType || 'anime',
    savedLength: images.value.length,
    index,
  }

  showModalImage.value = true
}

const goPrev = (selected) => {
  if (selected.index !== 0) {
    selectedImage.value = {
      image: images.value[selected.index - 1].image,
      prompt: images.value[selected.index - 1].prompt || '',
      apiType: images.value[selected.index - 1].apiType,
      savedLength: images.value.length,
      index: selected.index - 1,
    }
  }
}

const goNext = (selected) => {
  if (selected.index !== images.value.length - 1) {
    selectedImage.value = {
      image: images.value[selected.index + 1].image,
      prompt: images.value[selected.index + 1].prompt || '',
      apiType: images.value[selected.index + 1].apiType,
      savedLength: images.value.length,
      index: selected.index + 1,
    }
  }
}

onMounted(async () => {
  images.value = await fetchHistory()
})
</script>

<template>
  <PageTitle
    title="History"
    subtitle="A history of the last 25 images created, these are only available locally on the device/browser you generate them on. Click an image for options."
  />
  <div v-if="images && images.length">
    <div class="actions">
      <button v-if="!showClearConfirm" @click="showClearConfirm = true">clear history</button>
      <button v-else @click="clear">confirm clear?</button>
    </div>
    <div class="display-grid">
      <div v-for="(item, index) of images" :key="index" class="image">
        <img @click="showImage(item, index)" :src="`data:image/png;base64,${item.image}`" />
      </div>
    </div>
  </div>
  <div v-else>
    <p>you have no history</p>
  </div>
  <ModalImage
    v-if="showModalImage"
    :selectedImage="selectedImage"
    @prev="goPrev"
    @next="goNext"
    @close="showModalImage = false"
  />
</template>

<style scoped>
.actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin-bottom: 16px;
}

.display-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 20px;
}

.image {
  position: relative;
  display: flex;
  align-items: center;
  background: rgba(30, 30, 30, 0.6);
  border-radius: 6px;
}

.image img {
  border-radius: 6px;
  cursor: pointer;
  transition: 0.15s;
}

.image img:hover {
  opacity: 0.8;
}
</style>
