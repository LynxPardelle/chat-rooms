# Chat Rooms Application

Real-time chat application with Vue 3, NestJS, MongoDB, and Socket.io.

## 🌟 Features

- Real-time messaging with Socket.io
- User authentication system (simple, username-based)
- Message history with pagination
- Personalization options (avatar, message colors)
- Responsive design

## 🏗️ Architecture

This project follows a monorepo structure with:

- `/api` - NestJS backend with hexagonal architecture
- `/front` - Vue 3 frontend with modular component structure

## 🛠️ Tech Stack

### Frontend

- Vue 3 with Composition API
- TypeScript
- Pinia for state management
- Socket.io client
- Bootstrap for styling
- Vite for building

### Backend

- NestJS with TypeScript
- Socket.io for real-time communication
- MongoDB with Mongoose
- JWT for authentication
- Hexagonal architecture

## 🚀 Getting Started

### Prerequisites

- Node.js v18+
- MongoDB
- npm or yarn

### Installation

1. Clone the repository

   ```bash
   git clone https://github.com/yourusername/chat-rooms.git
   cd chat-rooms
   ```

2. Install dependencies for both projects

   ```bash
   # Install root dependencies
   npm install

   # Install API dependencies
   cd api
   npm install

   # Install Frontend dependencies
   cd ../front
   npm install
   ```

3. Configure environment variables

   ```bash
   # In the /api directory
   cp .env.example .env
   ```

4. Start MongoDB locally

   ```bash
   # Make sure MongoDB is running on your system
   ```

5. Run the development servers

   ```bash
   # In the root directory
   npm run dev
   ```

## 📝 Development Scripts

From the root directory:

- `npm run dev` - Start both frontend and backend in development mode
- `npm run build` - Build both projects
- `npm run test` - Run tests for both projects
- `npm run lint` - Run linters for both projects

## 🧪 Testing

- Backend: Jest + supertest
- Frontend: Vitest + Vue Testing Library

## 🔐 Security Features

- Input sanitization
- Rate limiting
- JWT authentication
- XSS prevention

## 🐳 Docker

This project includes Docker configuration for easy deployment to any environment.

### Running with Docker

1. Create a `.env.docker` file based on the example (already provided)
2. Build and start all services:
   ```bash
   npm run docker:build
   npm run docker:up
   ```
   
3. View logs:
   ```bash
   npm run docker:logs
   ```

4. Stop all services:
   ```bash
   npm run docker:down
   ```
   
5. Remove all containers and volumes:
   ```bash
   npm run docker:clean
   ```

### Docker Service Architecture

- **mongo**: MongoDB database
- **api**: NestJS backend API and Socket.io server
- **front**: Vue 3 frontend served via Nginx

## 📚 Documentation

- [API Documentation](./api/README.md)
- [Frontend Documentation](./front/README.md)
- [Socket Events Documentation](./docs/socket-events.md)

## 👨‍💻 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
