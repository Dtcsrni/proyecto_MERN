import React from "react";
import { Navigate } from "react-router-dom";
import { usarAutenticacion, type Rol } from "./autenticacion.tsx";


//Rutas protegidas, si no esta cargando muestra un mensaje
//Si no hay sesion, redigire a login
//Si hay rolesPermitidos, verifica que existe el rol

export function RutaProtegida({
    children,
    rolesPermitidos,
}: {
    children: React.ReactNode;
    rolesPermitidos?: Rol[];
}) {
    const { usuario, cargando } = usarAutenticacion();
    if (cargando) {
        return <div>Cargando...</div>;
    }
    if (!usuario) {
        return <Navigate to="/login" />;
    }
    if (rolesPermitidos && !rolesPermitidos.includes(usuario.rol)) {
        return <div>No tienes permiso para acceder a esta página.</div>;
    }
    return <>{children}</>;
}