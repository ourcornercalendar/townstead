"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "../../../../../convex/_generated/api";
import { toast } from "sonner";
import { useOrg } from "@/hooks/use-org";
import { useDefaultYear } from "@/hooks/use-default-year";
import { PageHeader } from "@/components/shared/page-header";
import { StepForm, type Step } from "@/components/shared/step-form";
import { SelectContact } from "./steps/select-contact";
import { SelectEditionYear } from "./steps/select-edition-year";
import { SelectAdTypes, type AdSelection } from "./steps/select-ad-types";
import type { SlotAssignment } from "./steps/assign-slots";
import {
  PaymentTermsStep,
  type PaymentTermsStepRef,
} from "./steps/payment-terms-step";
import { ReviewConfirm } from "./steps/review-confirm";
import type { PaymentTermsFormValues } from "@/lib/validators";
import { dollarsToCents } from "@/lib/utils";
import { useStableNow } from "@/hooks/use-stable-now";
import type { Id } from "../../../../../convex/_generated/dataModel";
import {
  User,
  Calendar,
  ShoppingCart,
  DollarSign,
  ClipboardCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const STEP_CARD_STYLES = [
  "border-l-blue-500",
  "border-l-violet-500",
  "border-l-emerald-500",
  "border-l-amber-500",
  "border-l-teal-500",
];

function paymentTermsToCents(terms: PaymentTermsFormValues) {
  return {
    ...terms,
    totalSale: dollarsToCents(terms.totalSale),
    discount1: terms.discount1 != null ? dollarsToCents(terms.discount1) : undefined,
    discount2: terms.discount2 != null ? dollarsToCents(terms.discount2) : undefined,
    additionalSale1: terms.additionalSale1 != null ? dollarsToCents(terms.additionalSale1) : undefined,
    additionalSale2: terms.additionalSale2 != null ? dollarsToCents(terms.additionalSale2) : undefined,
    trade: terms.trade != null ? dollarsToCents(terms.trade) : undefined,
    earlyDiscountAmount:
      terms.earlyDiscountType === "flat" && terms.earlyDiscountAmount != null
        ? dollarsToCents(terms.earlyDiscountAmount)
        : terms.earlyDiscountAmount,
    lateFeeAmount:
      terms.lateFeeType === "flat" && terms.lateFeeAmount != null
        ? dollarsToCents(terms.lateFeeAmount)
        : terms.lateFeeAmount,
    customSchedule: terms.customSchedule?.map((e) => ({
      ...e,
      amount: dollarsToCents(e.amount),
    })),
  };
}

const STEPS: Step[] = [
  { id: "contact", label: "Contact" },
  { id: "edition", label: "Edition & Year" },
  { id: "purchaseDetails", label: "Purchase Details" },
  { id: "terms", label: "Payment Terms" },
  { id: "review", label: "Review" },
];

interface PurchaseFormState {
  contactId: Id<"contacts"> | null;
  contactLabel: string;
  calendarEditionIds: Id<"calendarEditions">[];
  editionNames: string[];
  year: number;
  adSelections: AdSelection[];
  slotAssignments: SlotAssignment[];
  paymentTerms: PaymentTermsFormValues;
}

const currentYear = new Date().getFullYear();

const defaultPaymentTerms: PaymentTermsFormValues = {
  totalSale: 0,
  discount1: undefined,
  discount1Label: undefined,
  discount2: undefined,
  discount2Label: undefined,
  additionalSale1: undefined,
  additionalSale1Label: undefined,
  additionalSale2: undefined,
  additionalSale2Label: undefined,
  trade: undefined,
  earlyDiscountType: undefined,
  earlyDiscountAmount: undefined,
  lateFeeType: undefined,
  lateFeeAmount: undefined,
  dueDayOfMonth: 1,
  splitEqually: true,
  scheduleStartMonth: 1,
  scheduleStartYear: currentYear,
  scheduleEndMonth: 12,
  scheduleEndYear: currentYear,
  customSchedule: undefined,
  deliveryMethod: undefined,
  invoiceMessage: undefined,
  statementMessage: undefined,
};

export default function NewPurchasePage() {
  const { orgId } = useOrg();
  const { defaultYear } = useDefaultYear();
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillContactId = searchParams.get("contactId");
  const createPurchase = useMutation(api.purchases.mutations.create);
  const paymentTermsRef = useRef<PaymentTermsStepRef>(null);
  const now = useStableNow();

  const prefillContact = useQuery(
    api.contacts.queries.getById,
    prefillContactId ? { id: prefillContactId } : "skip"
  );

  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [prefilled, setPrefilled] = useState(false);

  const [formState, setFormState] = useState<PurchaseFormState>({
    contactId: null,
    contactLabel: "",
    calendarEditionIds: [],
    editionNames: [],
    // The edition being sold, not the one on the wall. A new sale in
    // September 2026 is for the 2027 calendar.
    year: defaultYear,
    adSelections: [],
    slotAssignments: [],
    paymentTerms: defaultPaymentTerms,
  });

  const existingPurchase = useQuery(
    api.purchases.queries.getByContactAndYear,
    formState.contactId ? { contactId: formState.contactId, year: formState.year, now } : "skip"
  );

  useEffect(() => {
    if (prefillContact && !prefilled) {
      const label = `${prefillContact.company ? prefillContact.company + " — " : ""}${prefillContact.firstName} ${prefillContact.lastName}`;
      setFormState((prev) => ({
        ...prev,
        contactId: prefillContact._id,
        contactLabel: label,
      }));
      setCurrentStep(1);
      setPrefilled(true);
    }
  }, [prefillContact, prefilled]);

  const suggestedTotal = useMemo(
    () => formState.adSelections.reduce((sum, sel) => sum + (sel.charge ?? 0), 0),
    [formState.adSelections]
  );

  const validationMessage = useMemo((): string | null => {
    switch (currentStep) {
      case 0:
        if (formState.contactId === null) return "Select a contact to continue.";
        return null;
      case 1:
        if (existingPurchase)
          return "This contact already has a purchase for this year. Edit the existing purchase instead.";
        if (formState.calendarEditionIds.length === 0)
          return "Select at least one calendar edition.";
        if (formState.year < 2000) return "Enter a valid year.";
        return null;
      case 2: {
        if (formState.adSelections.length === 0)
          return "Add at least one ad type.";
        const unassigned = formState.adSelections.find((ad) => {
          if (ad.slotsPerMonth === 0) return false;
          const matchingSlots = formState.slotAssignments.filter(
            (s) =>
              s.advertisementId === ad.advertisementId &&
              s.calendarEditionId === ad.calendarEditionId
          );
          return matchingSlots.length < ad.quantity;
        });
        if (unassigned) return "Assign all required slots before continuing.";
        return null;
      }
      case 3: {
        if (formState.paymentTerms.totalSale <= 0)
          return "Total sale must be greater than zero.";
        if (formState.paymentTerms.splitEqually === false) {
          const t = formState.paymentTerms;
          let scheduleBase =
            t.totalSale -
            (t.discount1 ?? 0) -
            (t.discount2 ?? 0) +
            (t.additionalSale1 ?? 0) +
            (t.additionalSale2 ?? 0) -
            (t.trade ?? 0);
          if (t.earlyDiscountType && t.earlyDiscountAmount) {
            const ed =
              t.earlyDiscountType === "flat"
                ? t.earlyDiscountAmount
                : t.totalSale * (t.earlyDiscountAmount / 100);
            scheduleBase -= ed;
          }
          const customTotal = (t.customSchedule ?? []).reduce(
            (s, e) => s + (e.amount ?? 0),
            0
          );
          if (scheduleBase > 0 && Math.abs(customTotal - scheduleBase) > 0.01)
            return "Custom schedule amounts must equal the net total.";
        }
        return null;
      }
      case 4:
        return null;
      default:
        return "Unknown step.";
    }
  }, [currentStep, formState]);

  const handleNext = useCallback(async () => {
    if (currentStep === 2) {
      setFormState((prev) => ({
        ...prev,
        paymentTerms: {
          ...prev.paymentTerms,
          ...(suggestedTotal > 0 ? { totalSale: suggestedTotal } : {}),
          scheduleStartYear: prev.paymentTerms.scheduleStartYear ?? prev.year,
          scheduleEndYear: prev.paymentTerms.scheduleEndYear ?? prev.year,
        },
      }));
    }
    if (currentStep === 3 && paymentTermsRef.current) {
      const validated = await paymentTermsRef.current.validate();
      if (!validated) return;
      setFormState((prev) => ({ ...prev, paymentTerms: validated }));
    }
    setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  }, [currentStep, suggestedTotal]);

  const handleBack = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (
      !orgId ||
      !formState.contactId ||
      formState.calendarEditionIds.length === 0
    )
      return;

    setIsSubmitting(true);
    try {
      const adSelections = formState.adSelections.map((sel) => ({
        advertisementId: sel.advertisementId,
        calendarEditionId: sel.calendarEditionId,
        quantity: sel.quantity,
        charge: sel.charge != null ? dollarsToCents(sel.charge) : undefined,
        slots: formState.slotAssignments
          .filter(
            (s) =>
              s.advertisementId === sel.advertisementId &&
              s.calendarEditionId === sel.calendarEditionId
          )
          .map((s) => ({
            month: s.month,
            slotNumber: s.slotNumber,
            date: s.date,
          })),
      }));

      const centTerms = paymentTermsToCents(formState.paymentTerms);
      const { splitEqually, dueDayOfMonth, ...restTerms } = centTerms;
      const termsPayload = {
        ...restTerms,
        splitEqually: splitEqually ?? true,
        dueDayOfMonth: dueDayOfMonth ?? 1,
      };

      const purchaseId = await createPurchase({
        orgId,
        contactId: formState.contactId,
        calendarEditionIds: formState.calendarEditionIds,
        year: formState.year,
        adSelections,
        paymentTerms: termsPayload,
      });

      toast.success("Purchase created");
      router.push(`/admin/purchases/${purchaseId}`);
    } catch {
      toast.error("Failed to create purchase");
    } finally {
      setIsSubmitting(false);
    }
  }, [orgId, formState, createPurchase, router]);

  const handlePaymentTermsChange = useCallback(
    (values: PaymentTermsFormValues) => {
      setFormState((prev) => ({ ...prev, paymentTerms: values }));
    },
    []
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Purchase"
        description="Create a new ad purchase for a contact"
      />

      {(formState.contactId || formState.year) && (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/50 px-4 py-2.5 text-sm">
          {formState.contactId && formState.contactLabel && (
            <Badge variant="outline" className="gap-1.5 border-blue-500/30 bg-blue-500/5 text-blue-700 dark:text-blue-400">
              <User className="h-3.5 w-3.5" />
              {formState.contactLabel}
            </Badge>
          )}
          {formState.year && (
            <Badge variant="outline" className="gap-1.5 border-violet-500/30 bg-violet-500/5 text-violet-700 dark:text-violet-400">
              <Calendar className="h-3.5 w-3.5" />
              {formState.year}
            </Badge>
          )}
          {formState.editionNames.length > 0 && (
            <Badge variant="outline" className="gap-1.5 border-violet-500/30 bg-violet-500/5 text-violet-700 dark:text-violet-400">
              {formState.editionNames.join(", ")}
            </Badge>
          )}
        </div>
      )}

      <StepForm
        steps={STEPS}
        currentStep={currentStep}
        onNext={handleNext}
        onBack={handleBack}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        canAdvance={validationMessage === null}
        validationMessage={validationMessage}
      >
        <div className={`rounded-lg border border-l-4 ${STEP_CARD_STYLES[currentStep]} bg-card p-6 shadow-sm`}>
          {currentStep === 0 && (
            <SelectContact
              value={formState.contactId}
              onChange={(contactId, contactLabel) =>
                setFormState((prev) => ({ ...prev, contactId, contactLabel }))
              }
            />
          )}

          {currentStep === 1 && (
            <SelectEditionYear
              editionIds={formState.calendarEditionIds}
              year={formState.year}
              contactId={formState.contactId}
              onEditionsChange={(ids, names) =>
                setFormState((prev) => ({
                  ...prev,
                  calendarEditionIds: ids,
                  editionNames: names,
                }))
              }
              onYearChange={(year) =>
                setFormState((prev) => ({ ...prev, year }))
              }
            />
          )}

          {currentStep === 2 && (
            <SelectAdTypes
              calendarEditionIds={formState.calendarEditionIds}
              editionNames={formState.editionNames}
              year={formState.year}
              selections={formState.adSelections}
              slotAssignments={formState.slotAssignments}
              onChange={(adSelections) =>
                setFormState((prev) => ({ ...prev, adSelections }))
              }
              onSlotsChange={(slotAssignments) =>
                setFormState((prev) => ({ ...prev, slotAssignments }))
              }
            />
          )}

          {currentStep === 3 && (
            <PaymentTermsStep
              ref={paymentTermsRef}
              values={formState.paymentTerms}
              onChange={handlePaymentTermsChange}
              suggestedTotal={suggestedTotal}
            />
          )}

          {currentStep === 4 && (
            <ReviewConfirm
              contactLabel={formState.contactLabel}
              calendarEditionIds={formState.calendarEditionIds}
              editionNames={formState.editionNames}
              year={formState.year}
              adSelections={formState.adSelections}
              slotAssignments={formState.slotAssignments}
              paymentTerms={formState.paymentTerms}
            />
          )}
        </div>
      </StepForm>
    </div>
  );
}
