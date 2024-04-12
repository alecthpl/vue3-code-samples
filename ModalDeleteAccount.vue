<script setup>
import { ref } from 'vue'
import { userStore } from '@/stores/store'
import { getAuth, deleteUser } from 'firebase/auth'
import { getFirestore, doc, getDoc, deleteDoc } from 'firebase/firestore'
import { getStorage, ref as fbRef, deleteObject } from 'firebase/storage'
import ButtonLoading from '@/components/ButtonLoading.vue'

const store = userStore()
const emit = defineEmits(['close'])

let loading = ref(false)

const deleteAccount = async () => {
  loading.value = true

  // get user
  const res = await getDoc(doc(getFirestore(), store.usersCollection, store.user.id))
  const data = res.exists() ? res.data() : {}

  // loop through and delete all images from storage
  if (data.images && data.images.length) {
    for await (const image of data.images) {
      await deleteObject(fbRef(getStorage(), `/images/${image.id}`))
    }
  }

  // delete user collection
  await deleteDoc(doc(getFirestore(), store.usersCollection, store.user.id))

  // delete user from auth
  await deleteUser(getAuth().currentUser)

  // log user out
  store.logUserOut()
}
</script>

<template>
  <div @click="$emit('close')" class="modal">
    <div @click.stop="" class="container">
      <div class="header">
        <h3>Delete Account?</h3>
      </div>
      <div class="content">
        <p>
          Deleting your account permenantly deletes your account and all saved images.
          <b>Your remaining credits can not be refunded</b>. This action is irreversible, are you
          sure you want to delete your account?
        </p>
      </div>
      <div class="footer">
        <button @click="$emit('close')">cancel</button>
        <ButtonLoading @click="deleteAccount" text="delete account" :loading="loading" />
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
  background: rgba(30, 30, 30, 0.7);
  z-index: 999;
}

.container {
  margin: auto;
  background: var(--color-bg);
  padding: 20px;
  border-radius: 6px;
  width: 100%;
  max-width: 600px;
  box-shadow: 0 5px 40px -5px rgba(30, 30, 30, 0.5);
  overflow-y: auto;
}

.content {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 20px;
}

.footer {
  margin-top: 40px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

button {
  min-width: 100px;
  background: var(--color-danger);
  border-color: var(--color-danger);
}

button:first-of-type {
  margin-right: 16px;
  background: unset;
  border-color: inherit;
  color: var(--color-primary) !important;
}

b {
  font-weight: 700;
  color: var(--color-danger);
}
</style>
