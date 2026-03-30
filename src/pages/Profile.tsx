import { User, Settings, LogOut, MapPin, Clock, BookOpen } from "lucide-react";

export default function ProfilePage() {
  return (
    <div className="px-6 md:px-12 py-8 max-w-4xl mx-auto w-full">
      <div className="glass-panel p-8 rounded-3xl mb-8 flex flex-col md:flex-row items-center md:items-start gap-8 relative overflow-hidden">
        {/* Decorative background element */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>

        <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-surface-container-high shrink-0 relative z-10">
          <img 
            alt="Alex Martinez" 
            className="w-full h-full object-cover" 
            src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=300&q=80" 
          />
        </div>
        
        <div className="flex-1 text-center md:text-left relative z-10">
          <div className="inline-block bg-primary/10 text-primary px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest mb-3">
            Freshman Student
          </div>
          <h1 className="font-headline text-4xl font-bold text-on-surface mb-2">Alex Martinez</h1>
          <p className="text-on-surface-variant text-sm max-w-md mx-auto md:mx-0 mb-6">
            Computer Science major. Still learning the campus layout and trying to find the best study spots before midterms.
          </p>
          
          <div className="flex flex-wrap justify-center md:justify-start gap-4">
            <button className="bg-surface-container hover:bg-surface-container-high text-on-surface px-6 py-2.5 rounded-xl text-sm font-bold transition-colors flex items-center gap-2">
              <Settings className="w-4 h-4" /> Edit Profile
            </button>
            <button className="bg-error/10 hover:bg-error/20 text-error px-6 py-2.5 rounded-xl text-sm font-bold transition-colors flex items-center gap-2">
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel p-6 rounded-2xl flex flex-col gap-3">
          <div className="w-10 h-10 bg-tertiary/10 rounded-lg flex items-center justify-center text-tertiary mb-2">
            <Clock className="w-5 h-5" />
          </div>
          <h3 className="font-headline font-bold text-lg text-on-surface">Time Saved</h3>
          <p className="text-3xl font-bold text-tertiary font-headline tracking-tighter">45 <span className="text-sm font-body text-on-surface-variant font-normal">mins</span></p>
          <p className="text-xs text-on-surface-variant">Estimated navigation time saved this week.</p>
        </div>

        <div className="glass-panel p-6 rounded-2xl flex flex-col gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary mb-2">
            <MapPin className="w-5 h-5" />
          </div>
          <h3 className="font-headline font-bold text-lg text-on-surface">Places Visited</h3>
          <p className="text-3xl font-bold text-primary font-headline tracking-tighter">12</p>
          <p className="text-xs text-on-surface-variant">Unique campus locations navigated to.</p>
        </div>

        <div className="glass-panel p-6 rounded-2xl flex flex-col gap-3">
          <div className="w-10 h-10 bg-secondary/10 rounded-lg flex items-center justify-center text-secondary mb-2">
            <BookOpen className="w-5 h-5" />
          </div>
          <h3 className="font-headline font-bold text-lg text-on-surface">Current Classes</h3>
          <div className="space-y-2 mt-1">
            <div className="flex justify-between items-center text-sm">
              <span className="text-on-surface font-medium">Intro to CS</span>
              <span className="text-on-surface-variant">ENG 105</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-on-surface font-medium">Calculus I</span>
              <span className="text-on-surface-variant">SCI 200</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
