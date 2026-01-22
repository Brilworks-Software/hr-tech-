import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Send, Loader2, CheckCircle, AlertCircle, Bot, User } from 'lucide-react';
import { aiInterviewService, AIInterviewMessage } from '../services/aiInterviewService';
import { interviewService } from '../services/interviewService';
import { useToast } from '../contexts/ToastContext';

export default function AIInterviewRoom() {
  const { interviewId } = useParams<{ interviewId: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [messages, setMessages] = useState<AIInterviewMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStarting, setIsStarting] = useState(true);
  const [isComplete, setIsComplete] = useState(false);
  const [interview, setInterview] = useState<any>(null);
  const [questionCount, setQuestionCount] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!interviewId) return;

    // Fetch interview details
    fetchInterviewDetails();

    // Subscribe to messages
    const unsubscribe = aiInterviewService.subscribeToInterviewMessages(
      interviewId,
      (newMessages) => {
        setMessages(newMessages);
        setIsStarting(false);
      }
    );

    return () => unsubscribe();
  }, [interviewId]);

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchInterviewDetails = async () => {
    if (!interviewId) return;

    try {
      const interviewData = await interviewService.getInterviewById(interviewId);
      if (!interviewData) {
        showToast('Interview not found', 'error');
        navigate('/');
        return;
      }

      setInterview(interviewData);

      // If interview hasn't started, start it
      if (interviewData.status === 'scheduled') {
        await startInterview(interviewData);
      } else if (interviewData.status === 'completed') {
        setIsComplete(true);
      }
    } catch (error) {
      console.error('Error fetching interview:', error);
      showToast('Error loading interview', 'error');
    }
  };

  const startInterview = async (interviewData: any) => {
    try {
      setIsStarting(true);
      const result = await aiInterviewService.startAIInterview(
        interviewId!,
        interviewData.applicationId,
        interviewData.jobId || ''
      );

      showToast('Interview started! The AI interviewer will guide you.', 'success');
      setIsStarting(false);
      
      // Focus on input
      setTimeout(() => inputRef.current?.focus(), 500);
    } catch (error) {
      console.error('Error starting interview:', error);
      showToast('Failed to start interview', 'error');
      setIsStarting(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!inputMessage.trim() || isLoading || isComplete) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');
    setIsLoading(true);

    try {
      const result = await aiInterviewService.sendMessage(interviewId!, userMessage);
      
      setQuestionCount(result.questionNumber);

      if (result.isComplete) {
        setIsComplete(true);
        showToast('Interview completed! Thank you for your time.', 'success');
        
        // Generate evaluation after a delay
        setTimeout(async () => {
          try {
            await aiInterviewService.generateEvaluation(interviewId!);
            showToast('Your interview has been evaluated', 'success');
          } catch (error) {
            console.error('Error generating evaluation:', error);
          }
        }, 2000);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      showToast('Failed to send message. Please try again.', 'error');
      setInputMessage(userMessage); // Restore message on error
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleEndInterview = () => {
    navigate('/');
    showToast('Interview ended. Our team will review your responses.', 'success');
  };

  if (isStarting) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Bot className="w-8 h-8 text-white animate-pulse" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Starting AI Interview</h2>
          <p className="text-slate-600 mb-4">
            Please wait while we prepare your interview session...
          </p>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-4 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">AI Interview</h1>
              <p className="text-sm text-slate-600">
                {isComplete ? 'Interview Completed' : `Question ${questionCount}`}
              </p>
            </div>
          </div>
          {isComplete && (
            <button
              onClick={handleEndInterview}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Exit Interview</span>
            </button>
          )}
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex ${msg.role === 'ai' ? 'justify-start' : 'justify-end'}`}
            >
              <div
                className={`max-w-[75%] rounded-2xl px-6 py-4 shadow-sm ${
                  msg.role === 'ai'
                    ? 'bg-white border border-slate-200'
                    : 'bg-blue-600 text-white'
                }`}
              >
                <div className="flex items-center space-x-2 mb-2">
                  {msg.role === 'ai' ? (
                    <>
                      <Bot className="w-4 h-4 text-blue-600" />
                      <span className="text-xs font-semibold text-blue-600">AI Interviewer</span>
                    </>
                  ) : (
                    <>
                      <User className="w-4 h-4" />
                      <span className="text-xs font-semibold opacity-90">You</span>
                    </>
                  )}
                  {msg.questionNumber && (
                    <span className="text-xs opacity-60">• Q{msg.questionNumber}</span>
                  )}
                </div>
                <p className={`text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'ai' ? 'text-slate-700' : 'text-white'
                }`}>
                  {msg.content}
                </p>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white border border-slate-200 rounded-2xl px-6 py-4 shadow-sm">
                <div className="flex items-center space-x-2">
                  <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                  <span className="text-sm text-slate-600">AI is thinking...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="bg-white border-t border-slate-200 px-4 py-4 shadow-lg">
        <div className="max-w-4xl mx-auto">
          {isComplete ? (
            <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4 text-center">
              <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <p className="text-green-800 font-semibold">Interview Completed Successfully!</p>
              <p className="text-sm text-green-700 mt-1">
                Thank you for your time. Our team will review your responses and get back to you soon.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSendMessage} className="flex items-center space-x-3">
              <input
                ref={inputRef}
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Type your answer here..."
                disabled={isLoading || isComplete}
                className="flex-1 px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-100 disabled:cursor-not-allowed"
              />
              <button
                type="submit"
                disabled={!inputMessage.trim() || isLoading || isComplete}
                className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
                <span className="font-medium">Send</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
