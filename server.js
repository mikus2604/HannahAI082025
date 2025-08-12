import express from "express";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(cors());
app.set('view engine', 'ejs');
app.set('views', './views');
app.use(express.urlencoded({ extended: true }));

// Request logger
app.use((req,res,next)=>{ console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`); next(); });

// Route to provide public Supabase credentials
app.get("/supabase-config", (req, res) => {
  res.json({
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY
  });
});

// Views: logged-in pages using shared header
app.get(['/dashboard','/dashboard.html'], (req,res)=> res.render('dashboard'));
app.get(['/calls','/calls.html'], (req,res)=> res.render('calls'));
app.get(['/analytics','/analytics.html'], (req,res)=> res.render('analytics'));
app.get(['/settings','/settings.html'], (req,res)=> res.render('settings'));
app.get(['/profile','/profile.html'], (req,res)=> res.render('profile'));
app.get(['/superuser','/superuser.html'], (req,res)=> res.render('superuser'));

// Static assets (must come AFTER view routes so .html routes render via EJS)
app.use(express.static("."));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
