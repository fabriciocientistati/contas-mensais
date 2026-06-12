const BIOMETRIC_CREDENTIAL_KEY = 'contas_mensais_biometric_credential';

export type BiometricCredential = {
  credentialId: string;
  email: string;
  createdAt: string;
};

type PublicKeyCredentialWithId = PublicKeyCredential & {
  rawId: ArrayBuffer;
};

function bufferToBase64Url(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlToBuffer(value: string) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes.buffer;
}

function randomBuffer(length = 32) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes.buffer;
}

export function getRegisteredBiometricCredential(): BiometricCredential | null {
  const rawCredential = localStorage.getItem(BIOMETRIC_CREDENTIAL_KEY);

  if (!rawCredential) {
    return null;
  }

  try {
    return JSON.parse(rawCredential) as BiometricCredential;
  } catch {
    localStorage.removeItem(BIOMETRIC_CREDENTIAL_KEY);
    return null;
  }
}

export function clearRegisteredBiometricCredential() {
  localStorage.removeItem(BIOMETRIC_CREDENTIAL_KEY);
}

export async function isPlatformBiometricAvailable() {
  if (!window.PublicKeyCredential || !navigator.credentials) {
    return false;
  }

  return PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
}

export async function registerPlatformBiometricCredential(email: string) {
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge: randomBuffer(),
      rp: {
        name: 'Contas Mensais',
      },
      user: {
        id: randomBuffer(16),
        name: email,
        displayName: email,
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        residentKey: 'preferred',
        userVerification: 'required',
      },
      timeout: 60000,
      attestation: 'none',
    },
  });

  if (!credential) {
    throw new Error('Nenhuma credencial biometrica foi criada.');
  }

  const publicKeyCredential = credential as PublicKeyCredentialWithId;
  const savedCredential: BiometricCredential = {
    credentialId: bufferToBase64Url(publicKeyCredential.rawId),
    email,
    createdAt: new Date().toISOString(),
  };

  localStorage.setItem(BIOMETRIC_CREDENTIAL_KEY, JSON.stringify(savedCredential));

  return savedCredential;
}

export async function authenticateWithPlatformBiometrics(credential: BiometricCredential) {
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: randomBuffer(),
      allowCredentials: [
        {
          id: base64UrlToBuffer(credential.credentialId),
          type: 'public-key',
          transports: ['internal'],
        },
      ],
      userVerification: 'required',
      timeout: 60000,
    },
  });

  return assertion instanceof PublicKeyCredential;
}
