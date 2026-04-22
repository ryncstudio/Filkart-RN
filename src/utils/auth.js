import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'filkart_jwt_token';
const USER_KEY = 'filkart_user_data';

/**
 * Store the JWT token after login
 */
export const storeToken = async (token) => {
  try {
    await AsyncStorage.setItem(TOKEN_KEY, token);
  } catch (error) {
    console.error('Error storing token:', error);
  }
};

/**
 * Retrieve the stored JWT token
 * Returns null if no token found
 */
export const getToken = async () => {
  try {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    return token;
  } catch (error) {
    console.error('Error getting token:', error);
    return null;
  }
};

/**
 * Remove the JWT token (logout)
 */
export const removeToken = async () => {
  try {
    await AsyncStorage.removeItem(TOKEN_KEY);
    await AsyncStorage.removeItem(USER_KEY);
  } catch (error) {
    console.error('Error removing token:', error);
  }
};

/**
 * Store user session data
 */
export const storeUserData = async (userData) => {
  try {
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(userData));
  } catch (error) {
    console.error('Error storing user data:', error);
  }
};

/**
 * Retrieve stored user data
 */
export const getUserData = async () => {
  try {
    const data = await AsyncStorage.getItem(USER_KEY);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Error getting user data:', error);
    return null;
  }
};

/**
 * Check if the user has a valid session
 * Returns { isAuthenticated: bool, token: string|null }
 */
export const checkUserSession = async () => {
  try {
    const token = await getToken();
    if (!token) {
      return { isAuthenticated: false, token: null };
    }
    // Optionally decode JWT to check expiry here
    return { isAuthenticated: true, token };
  } catch (error) {
    console.error('Error checking session:', error);
    return { isAuthenticated: false, token: null };
  }
};
