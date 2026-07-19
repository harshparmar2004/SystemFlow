import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, checkTeamNameExists } from '../lib/firebase';
import { HackathonEvent } from '../types';
import { cn } from '../lib/utils';
import { AlertCircle, Plus, Trash2, ArrowRight, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Mock Events Data
const MOCK_EVENTS: HackathonEvent[] = [
  {
    eventId: 'evt-2026-spring',
    eventName: 'Spring Campus Hackathon 2026',
    maxTeamSize: 4,
    minTeamSize: 2,
    registrationDeadline: '2026-08-01T00:00:00Z',
    isPaid: false,
    fee: 0
  },
  {
    eventId: 'evt-2026-ai',
    eventName: 'AI Innovation Challenge',
    maxTeamSize: 3,
    minTeamSize: 1,
    registrationDeadline: '2026-09-01T00:00:00Z',
    isPaid: true,
    fee: 15
  }
];

const memberSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email format"),
  phone: z.string().regex(/^\d{10}$/, "Phone must be exactly 10 digits"),
  collegeId: z.string().regex(/^[A-Z0-9]{5,15}$/, "Invalid College ID format (alphanumeric, 5-15 chars)"),
  role: z.enum(["lead", "member"])
});

const teamInfoSchema = z.object({
  eventId: z.string().min(1, "Please select an event"),
  teamName: z.string().min(3, "Team name must be at least 3 characters").max(30, "Team name too long"),
});

const formSchema = z.object({
  eventId: z.string().min(1, "Please select an event"),
  teamName: z.string().min(3, "Team name must be at least 3 characters"),
  members: z.array(memberSchema)
}).superRefine((data, ctx) => {
  // Check duplicate emails
  const emails = data.members.map(m => m.email);
  const uniqueEmails = new Set(emails);
  if (uniqueEmails.size !== emails.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Duplicate emails found among members",
      path: ["members"]
    });
  }
  
  // Need exactly one lead
  const leads = data.members.filter(m => m.role === 'lead');
  if (leads.length !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "There must be exactly one team lead",
      path: ["members"]
    });
  }
});

type FormValues = z.infer<typeof formSchema>;

export function HackathonForm({ currentStep, setCurrentStep }: { currentStep: number, setCurrentStep: (step: number) => void }) {
  const [selectedEvent, setSelectedEvent] = useState<HackathonEvent | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const { register, control, handleSubmit, watch, trigger, formState: { errors }, setValue } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      eventId: '',
      teamName: '',
      members: [{ name: '', email: '', phone: '', collegeId: '', role: 'lead' }]
    },
    mode: "onChange"
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "members"
  });

  const watchEventId = watch('eventId');
  const watchMembers = watch('members');
  const watchTeamName = watch('teamName');

  useEffect(() => {
    if (watchEventId) {
      const event = MOCK_EVENTS.find(e => e.eventId === watchEventId);
      setSelectedEvent(event || null);
    }
  }, [watchEventId]);

  const handleNextStep = async () => {
    let isValid = false;
    
    if (currentStep === 1) {
      isValid = await trigger(['eventId', 'teamName']);
      if (isValid && selectedEvent && watchTeamName) {
        // Dynamic team name check
        try {
          // Wrap in try-catch in case Firebase is not configured properly yet
          const exists = await checkTeamNameExists(selectedEvent.eventId, watchTeamName);
          if (exists) {
            setErrorMsg("Team name already exists for this event.");
            return;
          }
          setErrorMsg("");
        } catch (e) {
          console.warn("Firebase check failed (expected if not configured):", e);
          // Allow continuing for demo purposes if not configured
        }
      }
    } else if (currentStep === 2) {
      isValid = await trigger('members');
      if (isValid && selectedEvent) {
        if (watchMembers.length < selectedEvent.minTeamSize || watchMembers.length > selectedEvent.maxTeamSize) {
          setErrorMsg(`Team size must be between ${selectedEvent.minTeamSize} and ${selectedEvent.maxTeamSize} members.`);
          isValid = false;
        } else {
          setErrorMsg("");
        }
      }
    }

    if (isValid) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevStep = () => {
    setCurrentStep(currentStep - 1);
    setErrorMsg("");
  };

  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true);
    setErrorMsg("");
    
    try {
      const payload = {
        ...data,
        status: "pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      const teamsRef = collection(db, 'teams');
      await addDoc(teamsRef, payload);
      
      // Successfully submitted
      setSubmitSuccess(true);
      setCurrentStep(4);
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || "Failed to submit registration. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitSuccess && currentStep === 4) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center h-[60vh]">
        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6">
          <CheckCircle2 size={32} />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Registration Submitted!</h2>
        <p className="text-gray-600 max-w-md mx-auto mb-8">
          Your team has been registered with "pending" status. An OTP has been triggered for verification. Please check your emails.
        </p>
        <button 
          onClick={() => window.location.reload()}
          className="px-6 py-2 bg-burnt-orange text-white rounded-md font-medium hover:bg-burnt-orange-dark transition-colors"
        >
          Register Another Team
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6 md:px-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">
          {currentStep === 1 && "Team Information"}
          {currentStep === 2 && "Add Team Members"}
          {currentStep === 3 && "Review Details"}
        </h2>
        <p className="text-gray-500 mt-1">
          {currentStep === 1 && "Select the event and name your team."}
          {currentStep === 2 && selectedEvent && `Add between ${selectedEvent.minTeamSize} and ${selectedEvent.maxTeamSize} members.`}
          {currentStep === 3 && "Double-check your information before final submission."}
        </p>
      </div>

      {errorMsg && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md flex items-start gap-3">
          <AlertCircle className="text-red-500 mt-0.5" size={18} />
          <p className="text-sm text-red-700 font-medium">{errorMsg}</p>
        </div>
      )}
      
      {errors.members?.root && (
         <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md flex items-start gap-3">
         <AlertCircle className="text-red-500 mt-0.5" size={18} />
         <p className="text-sm text-red-700 font-medium">{errors.members.root.message}</p>
       </div>
      )}

      <div className="bg-white border border-border-muted rounded-lg p-6 md:p-8">
        <form onSubmit={handleSubmit(onSubmit)}>
          
          <AnimatePresence mode="wait">
            {currentStep === 1 && (
              <motion.div 
                key="step1"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-6"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Event</label>
                  <select 
                    {...register('eventId')}
                    className={cn(
                      "w-full px-4 py-2 bg-sand-50 border rounded-md focus:outline-none focus:ring-2 focus:ring-burnt-orange/50 focus:border-burnt-orange transition-colors",
                      errors.eventId ? "border-red-300" : "border-border-muted"
                    )}
                  >
                    <option value="">-- Choose an Event --</option>
                    {MOCK_EVENTS.map(ev => (
                      <option key={ev.eventId} value={ev.eventId}>{ev.eventName}</option>
                    ))}
                  </select>
                  {errors.eventId && <p className="text-red-500 text-xs mt-1">{errors.eventId.message}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Team Name</label>
                  <input 
                    type="text"
                    {...register('teamName')}
                    placeholder="e.g. Code Ninjas"
                    className={cn(
                      "w-full px-4 py-2 bg-sand-50 border rounded-md focus:outline-none focus:ring-2 focus:ring-burnt-orange/50 focus:border-burnt-orange transition-colors",
                      errors.teamName ? "border-red-300" : "border-border-muted"
                    )}
                  />
                  {errors.teamName && <p className="text-red-500 text-xs mt-1">{errors.teamName.message}</p>}
                </div>
              </motion.div>
            )}

            {currentStep === 2 && (
              <motion.div 
                key="step2"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-6"
              >
                {fields.map((field, index) => (
                  <div key={field.id} className="p-4 border border-border-muted rounded-md bg-sand-50 relative group">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="text-sm font-semibold text-gray-900">
                        Member {index + 1} {index === 0 && <span className="text-xs bg-burnt-orange/10 text-burnt-orange px-2 py-0.5 rounded ml-2">Lead</span>}
                      </h4>
                      {index > 0 && (
                        <button 
                          type="button" 
                          onClick={() => remove(index)}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Full Name</label>
                        <input 
                          {...register(`members.${index}.name`)}
                          className={cn(
                            "w-full px-3 py-1.5 text-sm bg-white border rounded focus:outline-none focus:border-burnt-orange",
                            errors.members?.[index]?.name ? "border-red-300" : "border-border-muted"
                          )}
                        />
                        {errors.members?.[index]?.name && <p className="text-red-500 text-xs mt-1">{errors.members[index]?.name?.message}</p>}
                      </div>
                      
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                        <input 
                          type="email"
                          {...register(`members.${index}.email`)}
                          className={cn(
                            "w-full px-3 py-1.5 text-sm bg-white border rounded focus:outline-none focus:border-burnt-orange",
                            errors.members?.[index]?.email ? "border-red-300" : "border-border-muted"
                          )}
                        />
                        {errors.members?.[index]?.email && <p className="text-red-500 text-xs mt-1">{errors.members[index]?.email?.message}</p>}
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
                        <input 
                          {...register(`members.${index}.phone`)}
                          className={cn(
                            "w-full px-3 py-1.5 text-sm bg-white border rounded focus:outline-none focus:border-burnt-orange",
                            errors.members?.[index]?.phone ? "border-red-300" : "border-border-muted"
                          )}
                        />
                        {errors.members?.[index]?.phone && <p className="text-red-500 text-xs mt-1">{errors.members[index]?.phone?.message}</p>}
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">College ID</label>
                        <input 
                          {...register(`members.${index}.collegeId`)}
                          className={cn(
                            "w-full px-3 py-1.5 text-sm bg-white border rounded focus:outline-none focus:border-burnt-orange",
                            errors.members?.[index]?.collegeId ? "border-red-300" : "border-border-muted"
                          )}
                        />
                        {errors.members?.[index]?.collegeId && <p className="text-red-500 text-xs mt-1">{errors.members[index]?.collegeId?.message}</p>}
                      </div>
                    </div>
                  </div>
                ))}
                
                {selectedEvent && fields.length < selectedEvent.maxTeamSize && (
                  <button 
                    type="button"
                    onClick={() => append({ name: '', email: '', phone: '', collegeId: '', role: 'member' })}
                    className="w-full py-3 border border-dashed border-border-muted text-gray-500 rounded-md flex items-center justify-center gap-2 hover:bg-sand-50 hover:text-burnt-orange hover:border-burnt-orange/50 transition-all text-sm font-medium"
                  >
                    <Plus size={16} /> Add Member
                  </button>
                )}
              </motion.div>
            )}

            {currentStep === 3 && (
              <motion.div 
                key="step3"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-6"
              >
                <div className="bg-sand-50 border border-border-muted rounded-md p-5">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Team Summary</h3>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <span className="block text-xs text-gray-500">Event</span>
                      <span className="font-medium text-gray-900">{selectedEvent?.eventName}</span>
                    </div>
                    <div>
                      <span className="block text-xs text-gray-500">Team Name</span>
                      <span className="font-medium text-gray-900">{watchTeamName}</span>
                    </div>
                  </div>
                  
                  <div className="mt-6">
                    <span className="block text-xs text-gray-500 mb-3">Members ({watchMembers.length})</span>
                    <ul className="space-y-3">
                      {watchMembers.map((m, i) => (
                        <li key={i} className="flex items-start justify-between py-2 border-b border-border-muted last:border-0">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{m.name} {m.role === 'lead' && <span className="text-[10px] bg-burnt-orange/10 text-burnt-orange px-1.5 py-0.5 rounded ml-2 uppercase tracking-wide">Lead</span>}</p>
                            <p className="text-xs text-gray-500">{m.email} • {m.phone}</p>
                          </div>
                          <span className="text-xs text-gray-400 font-mono">{m.collegeId}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-8 pt-6 border-t border-border-muted flex justify-between items-center">
            {currentStep > 1 ? (
              <button 
                type="button" 
                onClick={handlePrevStep}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 flex items-center gap-2"
                disabled={isSubmitting}
              >
                <ArrowLeft size={16} /> Back
              </button>
            ) : <div />}

            {currentStep < 3 ? (
              <button 
                type="button" 
                onClick={handleNextStep}
                className="px-6 py-2 bg-burnt-orange text-white rounded-md text-sm font-medium hover:bg-burnt-orange-dark transition-colors flex items-center gap-2"
              >
                Next Step <ArrowRight size={16} />
              </button>
            ) : (
              <button 
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2 bg-burnt-orange text-white rounded-md text-sm font-medium hover:bg-burnt-orange-dark transition-colors flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <><Loader2 size={16} className="animate-spin" /> Submitting...</>
                ) : (
                  <><CheckCircle2 size={16} /> Submit Registration</>
                )}
              </button>
            )}
          </div>

        </form>
      </div>
    </div>
  );
}
