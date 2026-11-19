import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'
import Constants from 'expo-constants'

const supabaseUrl     = Constants.expoConfig?.extra?.supabaseUrl     || ''
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey || ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,          // persist session in device storage
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,      // not needed in native apps
  },
})
