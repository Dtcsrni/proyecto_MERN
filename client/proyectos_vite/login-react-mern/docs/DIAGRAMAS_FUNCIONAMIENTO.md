## [BLOQUE DIDACTICO] docs/DIAGRAMAS_FUNCIONAMIENTO.md
- Que es: Documento de apoyo con diagramas del flujo funcional.
- Que hace: Describe visualmente procesos clave de autenticacion y autorizacion.
- Como lo hace: Usa secciones y diagramas para explicar interacciones frontend-backend-DB.

# Diagramas de Funcionamiento (login-react-mern)

Este documento resume el flujo principal del proyecto con diagramas Mermaid.

## 1) Arquitectura general

```mermaid
flowchart LR
    U[Usuario en navegador] --> F[Frontend React + Vite]
    F -->|fetch /api + credentials: include| B[Backend Express]
    B --> A[Modulo autenticacion]
    A --> D[(MongoDB - coleccion Usuario)]
    B --> C[Cookie HttpOnly tokenAcceso]
    C --> U
```

## 2) Flujo de inicio de sesion

```mermaid
sequenceDiagram
    participant U as Usuario
    participant F as Frontend (Login)
    participant B as Backend (/api/auth/login)
    participant DB as MongoDB

    U->>F: Ingresa correo y contrasena
    F->>B: POST /api/auth/login
    B->>DB: Buscar usuario activo por correo
    DB-->>B: Usuario + hashContrasena
    B->>B: bcrypt.compare(contrasena, hash)
    alt Credenciales validas
        B->>B: jwt.sign(usuarioToken)
        B-->>F: 200 + Set-Cookie tokenAcceso + usuario
        F-->>U: Redirige a /
    else Credenciales invalidas
        B-->>F: 401 mensaje error
        F-->>U: Muestra error en pantalla
    end
```

## 3) Flujo de restauracion de sesion al cargar la app

```mermaid
sequenceDiagram
    participant F as ProveedorAutenticacion
    participant B as Backend (/api/auth/me)

    F->>B: GET /api/auth/me (con cookie)
    alt Token valido
        B-->>F: 200 { usuario }
        F->>F: setUsuario(usuario)
        F->>F: setCargando(false)
    else Token ausente o invalido
        B-->>F: 401
        F->>F: setUsuario(null)
        F->>F: setCargando(false)
    end
```

## 4) Logica de RutaProtegida

```mermaid
flowchart TD
    I[Entrar a ruta protegida] --> Q{cargando?}
    Q -- Si --> L[Render: Cargando sesion...]
    Q -- No --> S{usuario existe?}
    S -- No --> R[Redirect /login]
    S -- Si --> P{rolesPermitidos definidos?}
    P -- No --> OK[Render children]
    P -- Si --> H{usuario.rol incluido?}
    H -- Si --> OK
    H -- No --> N[Render: No tienes permisos]
```

## 5) Modelo de datos de usuario

```mermaid
classDiagram
    class Usuario {
      +string _id
      +string correo
      +string hashContrasena
      +string rol
      +boolean activo
      +Date createdAt
      +Date updatedAt
    }
```

## 6) Maquina de estados de sesion en frontend

```mermaid
stateDiagram-v2
    [*] --> Cargando
    Cargando --> Autenticado: /me OK
    Cargando --> Invitado: /me 401
    Invitado --> Autenticado: login OK
    Autenticado --> Invitado: logout OK
    Autenticado --> Invitado: token expira / me 401
```

