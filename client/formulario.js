/* CRUD mínimo con delegación
   Estado (fuente de verdad) 🧱
   - listaReactivos: arreglo de objetos {pregunta, respuesta}
   - indiceEnEdicion: null si agregamos, o número si editamos

   POE 🔔
   - input: validar y habilitar botón de envío
   - submit: agregar o actualizar según indiceEnEdicion
   - click en lista: delegación para editar o eliminar

   Seguridad 🛡️
   - textContent imprime texto del usuario sin riesgo típico de inyección (XSS)
   - Evitar innerHTML como hábito
*/

const listaReactivos = [];
let indiceEnEdicion = null;

const formularioReactivo = document.getElementById("formulario-reactivo");
const textoPregunta = document.getElementById("textoPregunta");
const textoRespuesta = document.getElementById("textoRespuesta");
const textoError = document.getElementById("textoError");
const mensaje = document.getElementById("mensaje");
const btnGuardar = document.getElementById("btnGuardar");
const listaReactivosElemento = document.getElementById("listaReactivos");
const textoVacio = document.getElementById("textoVacio");

if (
  !formularioReactivo ||
  !textoPregunta ||
  !textoRespuesta ||
  !textoError ||
  !mensaje ||
  !btnGuardar ||
  !listaReactivosElemento ||
  !textoVacio
) {
  throw new Error("Faltan elementos del DOM. Revisa IDs en el HTML.");
}

function normalizarTexto(texto) {
  // Nota: NO fuerzo a lower-case para no alterar respuestas propias (p. ej. SQL, siglas, nombres).
  // Si lo quieres así, lo reactivamos, pero es una decisión de UX/dominio.
  return texto.trim().replace(/\s+/g, " ");
}

function validar() {
  const pregunta = normalizarTexto(textoPregunta.value);
  const respuesta = normalizarTexto(textoRespuesta.value);

  let errorMsg = "";
  if (pregunta.length < 10) errorMsg = "La pregunta debe tener al menos 10 caracteres.";
  else if (respuesta.length === 0) errorMsg = "La respuesta no puede estar vacía.";

  textoError.textContent = errorMsg;
  btnGuardar.disabled = Boolean(errorMsg);

  return !errorMsg;
}

function limpiarFormulario() {
  // reset() ya limpia inputs/textarea del form; no hace falta limpiar dos veces.
  formularioReactivo.reset();
  textoError.textContent = "";
  btnGuardar.disabled = true;

  indiceEnEdicion = null;
  mensaje.textContent = "Listo.";

  textoPregunta.focus();
}

function pintar() {
  // CORRECCIÓN: aquí usabas listaEnPantalla, pero tu variable real es listaReactivosElemento
  listaReactivosElemento.textContent = "";
  textoVacio.style.display = listaReactivos.length ? "none" : "block";

  for (let i = 0; i < listaReactivos.length; i++) {
    const li = document.createElement("li");

    const texto = document.createElement("p");
    texto.className = "texto-chico";
    texto.textContent = `#${i + 1} | P: ${listaReactivos[i].pregunta} | R: ${listaReactivos[i].respuesta}`;

    const acciones = document.createElement("div");
    acciones.className = "fila-acciones";

    const botonEditar = document.createElement("button");
    botonEditar.type = "button";
    botonEditar.className = "boton-chico";
    botonEditar.textContent = "Editar ✏️";
    botonEditar.dataset.accion = "editar";
    botonEditar.dataset.indice = String(i);

    const botonEliminar = document.createElement("button");
    botonEliminar.type = "button";
    botonEliminar.className = "boton-chico boton-peligro";
    botonEliminar.textContent = "Eliminar 🗑️";
    botonEliminar.dataset.accion = "eliminar";
    botonEliminar.dataset.indice = String(i);

    acciones.appendChild(botonEditar);
    acciones.appendChild(botonEliminar);

    li.appendChild(texto);
    li.appendChild(acciones);

    listaReactivosElemento.appendChild(li);
  }
}

/* Delegación 🫧: un listener para todos los botones en la lista */
listaReactivosElemento.addEventListener("click", (e) => {
  const boton = e.target.closest("button");
  if (!boton) return;

  const accion = boton.dataset.accion;
  const indice = Number(boton.dataset.indice);
  if (!accion || Number.isNaN(indice)) return;

  if (accion === "eliminar") {
    if (!confirm("¿Eliminar este reactivo? 🗑️")) return;

    listaReactivos.splice(indice, 1);

    // Si eliminaste el que estabas editando, salimos de edición ✅
    if (indiceEnEdicion === indice) {
      limpiarFormulario();
      mensaje.textContent = "Se eliminó el reactivo que estabas editando 🧯";
    } else {
      // Si borras uno “antes” del editado, el índice se recorre: ajustamos para evitar apuntar al equivocado.
      if (indiceEnEdicion !== null && indice < indiceEnEdicion) {
        indiceEnEdicion -= 1;
      }
      mensaje.textContent = "Reactivo eliminado 🗑️";
    }

    pintar();
    return;
  }

  if (accion === "editar") {
    indiceEnEdicion = indice;
    textoPregunta.value = listaReactivos[indice].pregunta;
    textoRespuesta.value = listaReactivos[indice].respuesta;

    validar();
    mensaje.textContent = `Editando reactivo #${indice + 1} ✏️`;
    textoPregunta.focus();
  }
});

/* Validación reactiva ✍️ */
textoPregunta.addEventListener("input", validar);
textoRespuesta.addEventListener("input", validar);

/* Guardar: agrega o actualiza según indiceEnEdicion 🧱 */
formularioReactivo.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!validar()) return;

  const reactivo = {
    pregunta: normalizarTexto(textoPregunta.value),
    respuesta: normalizarTexto(textoRespuesta.value),
  };

  if (indiceEnEdicion === null) {
    listaReactivos.push(reactivo);
    mensaje.textContent = "Reactivo agregado ✅";
  } else {
    listaReactivos[indiceEnEdicion] = reactivo;
    mensaje.textContent = `Reactivo #${indiceEnEdicion + 1} actualizado ✅`;
  }

  limpiarFormulario();
  pintar();
});

/* Inicio 🚀 */
validar();
pintar();
