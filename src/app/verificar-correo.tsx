/**
 * Verificación de correo.
 *
 * Después de crear la cuenta, Firebase inicia sesión pero la cuenta queda
 * "sin verificar". El layout raíz solo deja entrar a la bienvenida cuando
 * `verificado` es true, así que mientras tanto se muestra esta pantalla.
 *
 * Flujo:
 *   1. Al registrarse se envía el correo con sendEmailVerification.
 *   2. El estudiante abre el enlace del correo.
 *   3. Al volver a la app toca "Ya verifiqué mi correo": comprobamos con
 *      reload() y, si ya está verificado, el layout cambia solo.
 */
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Aviso } from '@/components/aviso';
import { Boton } from '@/components/boton';
import { PantallaHoja } from '@/components/pantalla-hoja';
import { Sacudida } from '@/components/sacudida';
import { colores, espacio, fuentes } from '@/constants/tema';
import { useSesion } from '@/context/sesion';
import { mensajeDeError } from '@/lib/errores-firebase';

type AvisoEstado = { tipo: 'error' | 'exito'; mensaje: string };

export default function PantallaVerificarCorreo() {
  const {
    usuario,
    nombre,
    errorEnvioVerificacion,
    enviarVerificacion,
    comprobarVerificacion,
    cerrarSesion,
  } = useSesion();

  const [aviso, setAviso] = useState<AvisoEstado | null>(null);
  const [comprobando, setComprobando] = useState(false);
  const [reenviando, setReenviando] = useState(false);
  const [sacudida, setSacudida] = useState(0);

  const correo = usuario?.email ?? '';
  const saludo = nombre?.split(' ')[0] || 'estudiante';

  async function manejarComprobacion() {
    setAviso(null);
    setComprobando(true);
    try {
      const verificado = await comprobarVerificacion();
      if (!verificado) {
        // El enlace aún no se ha usado (o se usó con otra cuenta).
        setAviso({
          tipo: 'error',
          mensaje: 'Todavía no confirmamos tu correo. Abre el enlace que te enviamos y vuelve a intentarlo.',
        });
        setSacudida((n) => n + 1);
      }
      // Si ya está verificado no navegamos aquí: Stack.Protected detecta el
      // cambio y muestra la bienvenida automáticamente.
    } catch (error) {
      setAviso({ tipo: 'error', mensaje: mensajeDeError(error) });
      setSacudida((n) => n + 1);
    } finally {
      // La pantalla sigue montada en ambos casos.
      setComprobando(false);
    }
  }

  async function manejarReenvio() {
    setAviso(null);
    setReenviando(true);
    try {
      await enviarVerificacion();
      setAviso({
        tipo: 'exito',
        mensaje: `Te enviamos otro correo a ${correo}. Revisa también la carpeta de spam.`,
      });
    } catch (error) {
      setAviso({ tipo: 'error', mensaje: mensajeDeError(error) });
      setSacudida((n) => n + 1);
    } finally {
      setReenviando(false);
    }
  }

  async function manejarSalida() {
    await cerrarSesion();
    // Al quedar usuario = null, el layout raíz muestra el login.
  }

  return (
    <PantallaHoja
      antetitulo="Un último paso"
      titulo={'Verifica\ntu correo'}
      bajada={`Hola, ${saludo}. Para entrar a la app necesitamos confirmar que ${correo} es tuyo.`}>
      <Sacudida disparo={sacudida} style={styles.grupo}>
        {aviso ? (
          <Aviso tipo={aviso.tipo} mensaje={aviso.mensaje} />
        ) : errorEnvioVerificacion ? (
          <Aviso tipo="error" mensaje={mensajeDeError(errorEnvioVerificacion)} />
        ) : null}

        <Text style={styles.instruccion}>
          Abre el mensaje que enviamos a tu correo y toca el enlace de verificación. Después vuelve
          aquí y confirma.
        </Text>
      </Sacudida>

      <Boton texto="Ya verifiqué mi correo" onPress={manejarComprobacion} cargando={comprobando} />
      <Boton
        variante="secundario"
        texto="Reenviar correo"
        onPress={manejarReenvio}
        cargando={reenviando}
      />
      <View style={styles.salida}>
        <Boton variante="enlace" texto="Cerrar sesión" onPress={manejarSalida} />
      </View>
    </PantallaHoja>
  );
}

const styles = StyleSheet.create({
  grupo: {
    gap: espacio.m,
  },
  instruccion: {
    color: colores.grafito,
    fontFamily: fuentes.texto,
    fontSize: 15,
    lineHeight: 22,
  },
  salida: {
    alignItems: 'center',
    marginTop: espacio.s,
  },
});
