import { defineStore } from 'pinia'
import { getAuth, signOut } from 'firebase/auth'
import { getFirestore, doc, getDoc } from 'firebase/firestore'
import { getAnalytics, setUserId } from 'firebase/analytics'

import { getCurrentUser } from '@/api/firebase'
import router from '@/router'

export const userStore = defineStore({
  id: 'userStore',
  state: () => ({
    // firebase config
    usersCollection: 'users',

    // state
    user: {},
    initialLoadComplete: false,
    imageVariation: null,
  }),
  getters: {
    stripeLink(state) {
      return `https://buy.stripe.com/{{apikey}}?client_reference_id=${state.user.id}`
    },
  },
  actions: {
    async fetchUser() {
      try {
        const user = await getCurrentUser()

        const res = await getDoc(doc(getFirestore(), this.usersCollection, user.uid))

        this.user = await res.data()

        // set user id in analytics
        const analytics = getAnalytics()
        setUserId(analytics, this.user.id)
      } catch (err) {
        console.log(err)
      }
    },
    async fetchInitialData() {
      await this.fetchUser()

      this.initialLoadComplete = true

      // for signup or login
      if (this.user.id && router.currentRoute.value.name === 'auth') {
        router.push('/')
      }
    },
    async logUserOut() {
      await signOut(getAuth())
      // resets state to initial state
      userStore().$reset()
      router.push('/auth')
    },
  },
})
