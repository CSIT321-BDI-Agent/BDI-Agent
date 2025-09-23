# BDI-Agent: Blocks World Simulation

A classic AI environment implementing **BDI (Belief-Desire-Intention) planning** for manipulating colored blocks to achieve goal configurations. This full-stack application demonstrates goal-stack planning algorithms in an interactive web-based blocks world simulator.

## 🎯 Features

- **Interactive Blocks World**: Drag-and-drop interface for creating block configurations
- **BDI Planning Algorithm**: Goal-stack planning with belief, desire, and intention modeling
- **Visual Animation System**: Smooth CSS transitions with robotic claw visualization
- **User Authentication**: Secure user accounts with bcrypt password hashing
- **World Persistence**: Save and load block configurations per user
- **Real-time Planning**: Watch the AI agent execute step-by-step plans to achieve goals

## 🏗️ Architecture

**Backend**: Node.js + Express + MongoDB
- RESTful API for user authentication and world persistence
- Mongoose ODM for database operations
- bcrypt for secure password hashing

**Frontend**: Vanilla JavaScript + HTML5 + CSS3
- No build process - direct file editing and browser refresh
- Embedded CSS and JavaScript for simplicity
- Responsive design with modern UI components

## 📋 Prerequisites

- **Node.js** (v14 or higher)
- **MongoDB** (local installation or MongoDB Atlas)
- **Modern web browser** (Chrome, Firefox, Safari, Edge)

## 🚀 Installation

### 1. Clone the Repository
```bash
git clone https://github.com/CSIT321-BDI-Agent/BDI-Agent.git
cd BDI-Agent
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Set Up MongoDB
**Option A: Local MongoDB**
```bash
# Install MongoDB Community Edition
# Start MongoDB service
mongod --dbpath /path/to/your/db
```

**Option B: MongoDB Atlas (Cloud)**
1. Create a free account at [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Create a new cluster and get your connection string
3. Create a `.env` file in the project root:
```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/blocks_world
PORT=3000
```

### 4. Start the Application
```bash
node server.js
```

The server will start on `http://localhost:3000`

## 🎮 Usage

### Getting Started
1. **Create an Account**: Navigate to the signup page and create a new user account
2. **Add Blocks**: Use the "Add Block" feature to create blocks (single letters A-Z)
3. **Set Goals**: Enter a goal configuration like "A on B on C"
4. **Watch Planning**: Click "Start Simulation" to see the BDI agent plan and execute moves
5. **Save Worlds**: Save interesting configurations for later use

### Goal Syntax
Goals are specified in natural language format:
- `A on B` - Places block A on top of block B
- `A on B on C` - Creates a stack with C at bottom, B in middle, A on top
- Case-insensitive, separated by "on" keyword

### Planning Algorithm
The system uses **goal-stack planning** with these operations:
- `clearBlock(X)` - Remove all blocks from on top of block X
- `putOn(X, Y)` - Place block X on top of block Y (or Table)
- Plans are executed step-by-step with visual feedback

## 🛠️ Development

### Project Structure
```
BDI-Agent/
├── server.js              # Express server and API routes
├── package.json           # Dependencies and project metadata
├── public/                # Static frontend files
│   ├── index.html         # Main simulation interface
│   ├── login.html         # User authentication
│   ├── signup.html        # User registration
│   ├── script.js          # Core simulation engine
│   └── style.css          # Styling and animations
└── .github/
    └── copilot-instructions.md  # AI coding guidelines
```

### API Endpoints
- `POST /users/signup` - User registration
- `POST /login` - User authentication
- `POST /worlds` - Save world configuration
- `GET /worlds/:id?userId=` - Load specific world
- Static files served from `/public`

### Development Workflow
1. **Backend Changes**: Edit `server.js` and restart with `node server.js`
2. **Frontend Changes**: Edit files in `public/` and refresh browser
3. **Database**: MongoDB collections: `users` and `worlds`

### Environment Variables
```env
PORT=3000                                    # Server port (default: 3000)
MONGODB_URI=mongodb://localhost:27017/blocks_world  # Database connection
```

## 🔧 Troubleshooting

### Common Issues

**Server won't start**
- Check if MongoDB is running: `mongod --version`
- Verify port 3000 is available: `netstat -an | findstr 3000`

**Cannot save worlds**
- Ensure you're logged in (check browser localStorage)
- Verify MongoDB connection in server logs

**Blocks won't move**
- Check browser console for JavaScript errors
- Ensure goal syntax is correct (e.g., "A on B on C")

**Authentication fails**
- Clear browser localStorage: `localStorage.clear()`
- Check MongoDB users collection exists

### Known Issues
- **Duplicate route**: `/worlds` POST endpoint defined twice in `server.js` (lines 24 & 42)
- **Missing endpoint**: Frontend expects `GET /worlds?userId=` for listing user worlds
- **Hardcoded URLs**: API base URL hardcoded as `http://localhost:3000`

## 🧪 Testing

Currently no automated tests. Manual testing workflow:
1. Create user account
2. Add blocks A, B, C
3. Set goal "A on B on C"
4. Verify planning and execution
5. Save and reload world

## 📚 Academic Context

This project demonstrates key AI concepts:
- **Planning Algorithms**: Goal-stack planning with state-space search
- **BDI Architecture**: Belief (world state), Desire (goals), Intention (plans)
- **Knowledge Representation**: Predicate logic for block relationships
- **Human-Computer Interaction**: Visual programming interfaces

Suitable for courses in:
- Artificial Intelligence
- Knowledge Representation
- Planning and Scheduling
- Web Development
- Human-Computer Interaction

## 🙋‍♂️ Support

For issues and questions:
- Check the troubleshooting section above
- Review the [Copilot Instructions](.github/copilot-instructions.md) for development guidelines
- Create an issue in the GitHub repository

---

**Built with ❤️ for AI education and demonstration**