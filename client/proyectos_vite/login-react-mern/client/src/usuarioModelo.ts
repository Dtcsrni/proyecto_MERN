import mongoose from 'mongoose';

//Roles válidos 

export const ROLES_VALIDOS = ['administrador', 'usuario', "desarrollador", "super_usuario"] as const;
export type Rol = (typeof ROLES_VALIDOS)[number];

//Payload mínimo para token JWT
export type UsuarioToken = {
    id:string;
    correo:string;
    rol:Rol;
}
//Definición del esquema de usuario
const esquemaUsuario = new mongoose.Schema(
    {
        correo: { type: String, required: true, unique: true, trim: true , 
            lowercase: true
        },
        hashContrasena: { type: String, required: true },
        rol: { type: String, enum: ROLES_VALIDOS, default: 'usuario' },
        activo: { type: Boolean, default: true },
    },
    {
        timestamps: true,
    }
);

export const Usuario = mongoose.model('Usuario', esquemaUsuario);