/**
 * Contexto de sesión: el único lugar de la app que habla con Firebase Auth.
 *
 * Las pantallas no importan Firebase directamente; llaman a las funciones de
 * este contexto (iniciarSesion, registrarse, etc.). Así, si mañana se cambia
 * Firebase por otro proveedor, solo se reescribe este archivo.
 */
import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  updateProfile,
  type User,
} from 'firebase/auth';
import { createContext, use, useEffect, useState, type ReactNode } from 'react';
 
import { auth } from '@/config/firebase';
 
type ValorSesion = {
  /** Usuario conectado, o null si nadie ha iniciado sesión. */
  usuario: User | null;
  /** Nombre del perfil (displayName), siempre actualizado tras el registro. */
  nombre: string | null;
  /** true mientras Firebase revisa si hay una sesión guardada. */
  cargando: boolean;
  /**
   * true cuando Firebase confirmó el correo de la cuenta.
   * Va aparte de `usuario` porque emailVerified no cambia su referencia y
   * React no volvería a dibujar las pantallas al verificarse.
   */
  verificado: boolean;
  /** Error del envío inicial de verificación, mostrado en esa pantalla. */
  errorEnvioVerificacion: unknown | null;
  iniciarSesion: (correo: string, clave: string) => Promise<void>;
  registrarse: (nombre: string, correo: string, clave: string) => Promise<void>;
  /** Vuelve a enviar el correo de verificación a la cuenta conectada. */
  enviarVerificacion: () => Promise<void>;
  /**
   * Pregunta a Firebase si el correo ya fue verificado.
   * @returns true si la cuenta quedó verificada.
   */
  comprobarVerificacion: () => Promise<boolean>;
  enviarCorreoRecuperacion: (correo: string) => Promise<void>;
  cambiarClave: (claveActual: string, claveNueva: string) => Promise<void>;
  cerrarSesion: () => Promise<void>;
};
 
const ContextoSesion = createContext<ValorSesion | null>(null);
 
/** Hook para leer la sesión desde cualquier pantalla. */
export function useSesion(): ValorSesion {
  // `use` es la forma moderna (React 19) de leer un contexto.
  const valor = use(ContextoSesion);
  if (!valor) {
    throw new Error('useSesion debe usarse dentro de <ProveedorSesion>.');
  }
  return valor;
}
 
export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<User | null>(null);
  const [cargando, setCargando] = useState(true);
  // Nombre del perfil guardado aparte: updateProfile modifica el mismo objeto
  // `user` sin cambiar su referencia, así que React no detectaría el cambio
  // si las pantallas leyeran usuario.displayName directamente.
  const [nombre, setNombre] = useState<string | null>(null);
  const [verificado, setVerificado] = useState(false);
  const [errorEnvioVerificacion, setErrorEnvioVerificacion] = useState<unknown | null>(null);

  useEffect(() => {
    // onAuthStateChanged se dispara al arrancar (con la sesión guardada o null)
    // y cada vez que alguien inicia o cierra sesión. Es la fuente de verdad:
    // la navegación (Stack.Protected en _layout.tsx) depende de este estado.
    const cancelarSuscripcion = onAuthStateChanged(auth, (usuarioFirebase) => {
      setUsuario(usuarioFirebase);
      setNombre(usuarioFirebase?.displayName ?? null);
      setVerificado(usuarioFirebase?.emailVerified ?? false);
      if (!usuarioFirebase) setErrorEnvioVerificacion(null);
      setCargando(false);
    });
    // Al desmontar el proveedor dejamos de escuchar para no fugar memoria.
    return cancelarSuscripcion;
  }, []);
 
  async function iniciarSesion(correo: string, clave: string) {
    await signInWithEmailAndPassword(auth, correo.trim(), clave);
    // No navegamos aquí: onAuthStateChanged actualiza `usuario` y el
    // Stack.Protected muestra bienvenida o verificación según el correo.
  }
 
  async function registrarse(nombreCompleto: string, correo: string, clave: string) {
    // Crear la cuenta también inicia la sesión, pero la cuenta nace SIN
    // verificar: el layout raíz mostrará la pantalla de verificación.
    const credencial = await createUserWithEmailAndPassword(auth, correo.trim(), clave);
    // Enviamos el enlace de verificación (plantilla editable en la consola:
    // Authentication > Templates > Email address verification). El usuario
    // permanece en la pantalla de verificación aunque falle el envío.
    try {
      await sendEmailVerification(credencial.user);
      setErrorEnvioVerificacion(null);
    } catch (error) {
      setErrorEnvioVerificacion(error);
    }
    // Guardamos el nombre en el perfil de Firebase (campo displayName).
    const nombreLimpio = nombreCompleto.trim();
    await updateProfile(credencial.user, { displayName: nombreLimpio });
    // updateProfile modifica el mismo objeto `user`, así que actualizamos
    // también el estado del contexto.
    setNombre(nombreLimpio);
  }

  async function enviarVerificacion() {
    const actual = auth.currentUser;
    if (!actual) throw new Error('No hay una sesión activa.');
    setErrorEnvioVerificacion(null);
    try {
      await sendEmailVerification(actual);
    } catch (error) {
      setErrorEnvioVerificacion(error);
      throw error;
    }
  }

  async function comprobarVerificacion() {
    const actual = auth.currentUser;
    if (!actual) return false;
    // emailVerified se queda en caché hasta llamar a reload().
    await actual.reload();
    const verificadoAhora = auth.currentUser?.emailVerified ?? false;
    setVerificado(verificadoAhora);
    return verificadoAhora;
  }
 
  async function enviarCorreoRecuperacion(correo: string) {
    // Firebase envía un correo con un enlace a su página de restablecimiento.
    // Si el correo no existe, por la protección de enumeración NO lanza error:
    // por eso la pantalla muestra un mensaje neutro.
    await sendPasswordResetEmail(auth, correo.trim());
  }
 
  async function cambiarClave(claveActual: string, claveNueva: string) {
    const actual = auth.currentUser;
    if (!actual?.email) throw new Error('No hay una sesión activa.');
 
    // updatePassword es una operación sensible: Firebase la rechaza con
    // "auth/requires-recent-login" si la sesión no es reciente. Por eso
    // primero confirmamos la identidad con la contraseña actual.
    const credencial = EmailAuthProvider.credential(actual.email, claveActual);
    await reauthenticateWithCredential(actual, credencial);
    await updatePassword(actual, claveNueva);
  }
 
  async function cerrarSesion() {
    await signOut(auth);
  }
 
  return (
    <ContextoSesion
      value={{
        usuario,
        nombre,
        cargando,
        verificado,
        errorEnvioVerificacion,
        iniciarSesion,
        registrarse,
        enviarVerificacion,
        comprobarVerificacion,
        enviarCorreoRecuperacion,
        cambiarClave,
        cerrarSesion,
      }}>
      {children}
    </ContextoSesion>
  );
}
