import { GoogleSignin } from "@react-native-google-signin/google-signin";
import auth from "@react-native-firebase/auth";

GoogleSignin.configure({
  webClientId: "314818251696-n1fklhtg2r5iiflj3gh6v6ckeitn7fvg.apps.googleusercontent.com",
});

export async function googleSignIn() {
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const signInResult = await GoogleSignin.signIn();
  const idToken = signInResult.data?.idToken ?? signInResult.idToken;

  if (!idToken) throw new Error("Google sign-in did not return an ID token.");

  // Get the access token separately
  const tokens = await GoogleSignin.getTokens();
  const accessToken = tokens.accessToken;

  const credential = auth.GoogleAuthProvider.credential(idToken, accessToken);
  await auth().signInWithCredential(credential);

  return idToken;
}

export async function googleSignOut() {
  try {
    await GoogleSignin.signOut();
    await auth().signOut();
  } catch {}
}
