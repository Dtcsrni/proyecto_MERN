//Helper para llamadas remotas a la API desde el frontend
//Las credenciales deben incluir el cookies httpOnly tokenAcceso para autenticación

export async function consultarApi<T>(ruta: string, opciones: RequestInit = {}): Promise<T> {
    const respuesta = await fetch(ruta, {...opciones, 
        headers: {
            "Content-Type": "application/json",
            ...opciones.headers || {}
        },
        credentials: "include"
    });

    //intentamos leer JSON incluido. Si falla devolvemos un objeto vacío
    const datos = (await respuesta.json().catch(() => ({}))) as any;

    //Si no es una respuesta 200, lanzamos un error a la GUI
    if (!respuesta.ok) {
        throw new Error(datos.mensaje || "Error desconocido al comunicarse con el servidor.");
    }

    return datos as T;
}
