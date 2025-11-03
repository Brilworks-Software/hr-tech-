import { useState, useEffect } from 'react';
import { Search, Users, Mail, Phone, FileText } from 'lucide-react';
import { Candidate } from '../lib/firebase';
import { candidateService } from '../services/candidateService';

export default function CandidatesView() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const unsubscribe = candidateService.subscribeToCandidates((candidatesData) => {
      setCandidates(candidatesData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredCandidates = candidates.filter(
    (candidate) =>
      candidate.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      candidate.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search candidates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div className="bg-white rounded-lg border border-slate-200 px-4 py-2.5">
          <span className="text-sm text-slate-600">Total Candidates: </span>
          <span className="text-lg font-bold text-slate-900">{candidates.length}</span>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredCandidates.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border-2 border-dashed border-slate-300">
          <Users className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-slate-900 mb-2">No candidates found</h3>
          <p className="text-slate-600">
            {searchTerm ? 'Try adjusting your search criteria' : 'Candidates will appear here once they apply'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCandidates.map((candidate) => (
            <div
              key={candidate.id}
              className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-xl hover:border-blue-300 transition-all"
            >
              <div className="flex items-center space-x-4 mb-4">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-full flex items-center justify-center text-white font-bold text-2xl">
                  {candidate.name[0]}
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-slate-900">{candidate.name}</h3>
                  <p className="text-sm text-slate-600">Candidate</p>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center text-sm text-slate-600">
                  <Mail className="w-4 h-4 mr-2 text-slate-400" />
                  {candidate.email}
                </div>
                {candidate.phone && (
                  <div className="flex items-center text-sm text-slate-600">
                    <Phone className="w-4 h-4 mr-2 text-slate-400" />
                    {candidate.phone}
                  </div>
                )}
                {candidate.resumeUrl && (
                  <div className="flex items-center text-sm text-blue-600 hover:text-blue-700 cursor-pointer">
                    <FileText className="w-4 h-4 mr-2" />
                    View Resume
                  </div>
                )}
              </div>

              <button className="w-full mt-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors">
                View Full Profile →
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
