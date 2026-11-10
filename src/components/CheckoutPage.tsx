import { useEffect, useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  CreditCard,
  MapPin,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Trash2,
} from 'lucide-react';
import {
  FREE_SHIPPING_THRESHOLD_POISHA,
  STANDARD_SHIPPING_POISHA,
  formatTaka,
} from '../data/catalog';
import { saveVerifiedOrderToFirestore } from '../firebase';
import type { CartItem, GarmentSize, OrderRecordItem } from '../types';
import { GarmentVisual } from './GarmentVisual';

interface CheckoutPageProps {
  cart: CartItem[];
  orders: OrderRecordItem[];
  userUid: string | null;
  defaultRecipientName: string;
  onUpdateQuantity: (garmentId: string, size: GarmentSize, delta: number) => void;
  onRemoveItem: (garmentId: string, size: GarmentSize) => void;
  onClearCart: () => void;
  onSignInRequest: () => Promise<void>;
}

interface VerifiedReceipt {
  orderNumber: string;
  totalCents: number;
  paymentMethod: 'card' | 'cod';
  paymentRef: string;
  itemsSummary: string;
  recipientName: string;
  shippingAddress: string;
}

type CheckoutStage = 1 | 2 | 3 | 4;

const STEPPER_STAGES: Array<{
  stage: CheckoutStage;
  title: string;
  subtitle: string;
}> = [
  { stage: 1, title: 'Shopping Bag', subtitle: 'Review items & sizes' },
  { stage: 2, title: 'Delivery Info', subtitle: 'Address & contact' },
  { stage: 3, title: 'Payment', subtitle: 'COD or card verification' },
  { stage: 4, title: 'Confirmed', subtitle: 'Verified receipt' },
];

function getShippingProgressWidthClass(subtotal: number, threshold: number): string {
  if (subtotal <= 0) return 'w-0';
  const ratio = subtotal / threshold;
  if (ratio >= 1) return 'w-full';
  if (ratio >= 0.75) return 'w-3/4';
  if (ratio >= 0.5) return 'w-1/2';
  if (ratio >= 0.25) return 'w-1/4';
  return 'w-1/6';
}

export function CheckoutPage({
  cart,
  orders,
  userUid,
  defaultRecipientName,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onSignInRequest,
}: CheckoutPageProps) {
  const [viewMode, setViewMode] = useState<'checkout_flow' | 'orders'>('checkout_flow');
  const [checkoutStep, setCheckoutStep] = useState<1 | 2 | 3>(1);

  const [recipientName, setRecipientName] = useState(defaultRecipientName || '');
  const [shippingAddress, setShippingAddress] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [phone, setPhone] = useState('');

  const [paymentMethod, setPaymentMethod] = useState<'card' | 'cod'>('cod');
  const [cardholderName, setCardholderName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');

  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmedReceipt, setConfirmedReceipt] = useState<VerifiedReceipt | null>(null);

  useEffect(() => {
    if (defaultRecipientName && !recipientName) {
      setRecipientName(defaultRecipientName);
    }
  }, [defaultRecipientName, recipientName]);

  // Reset back to Step 1 if cart becomes empty while not showing a confirmed receipt
  useEffect(() => {
    if (cart.length === 0 && !confirmedReceipt && checkoutStep !== 1) {
      setCheckoutStep(1);
    }
  }, [cart.length, confirmedReceipt, checkoutStep]);

  const itemCount = cart.reduce((sum, entry) => sum + entry.quantity, 0);
  const subtotalCents = cart.reduce(
    (sum, entry) => sum + entry.garment.priceCents * entry.quantity,
    0
  );
  const shippingCents =
    subtotalCents === 0 || subtotalCents >= FREE_SHIPPING_THRESHOLD_POISHA
      ? 0
      : STANDARD_SHIPPING_POISHA;
  const totalCents = subtotalCents + shippingCents;
  const freeShippingRemaining = Math.max(0, FREE_SHIPPING_THRESHOLD_POISHA - subtotalCents);

  const currentStage: CheckoutStage = confirmedReceipt ? 4 : checkoutStep;

  const progressWidthClass =
    currentStage === 1
      ? 'w-1/4'
      : currentStage === 2
        ? 'w-2/4'
        : currentStage === 3
          ? 'w-3/4'
          : 'w-full';

  const isDeliveryValid = () =>
    recipientName.trim().length >= 2 &&
    shippingAddress.trim().length >= 4 &&
    postalCode.trim().length >= 2 &&
    phone.trim().length >= 5;

  const handleAdvanceToPayment = (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!isDeliveryValid()) {
      setErrorMsg(
        'Please complete your full name, street address, postal code, and mobile number before continuing.'
      );
      return;
    }
    setCheckoutStep(3);
  };

  const handleStepClick = (targetStage: CheckoutStage) => {
    if (confirmedReceipt || targetStage === 4) return;
    setErrorMsg(null);
    if (targetStage === 1) {
      setCheckoutStep(1);
      return;
    }
    if (cart.length === 0) return;
    if (targetStage === 2) {
      setCheckoutStep(2);
      return;
    }
    if (targetStage === 3) {
      if (isDeliveryValid()) {
        setCheckoutStep(3);
      } else {
        setCheckoutStep(2);
        setErrorMsg('Please fill in your delivery details first to unlock payment.');
      }
    }
  };

  const formatCardNumberInput = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 16);
    return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
  };

  const formatExpiryInput = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 4);
    if (digits.length >= 3) {
      return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    }
    return digits;
  };

  const handlePlaceOrder = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (cart.length === 0) {
      setErrorMsg('Your shopping bag is empty.');
      return;
    }

    if (!isDeliveryValid()) {
      setCheckoutStep(2);
      setErrorMsg('Please verify your delivery information before placing your order.');
      return;
    }

    setProcessing(true);
    try {
      const response = await fetch('/api/checkout/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.map((entry) => ({
            id: entry.garment.id,
            name: entry.garment.name,
            size: entry.size,
            priceCents: entry.garment.priceCents,
            quantity: entry.quantity,
          })),
          shipping: {
            recipientName: recipientName.trim(),
            shippingAddress: shippingAddress.trim(),
            postalCode: postalCode.trim(),
            phone: phone.trim(),
          },
          payment: {
            method: paymentMethod,
            cardholderName: cardholderName.trim(),
            cardNumber,
            expiry,
            cvc,
          },
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Payment verification declined.');
      }

      if (userUid) {
        await saveVerifiedOrderToFirestore(userUid, {
          orderNumber: result.orderNumber,
          itemCount: result.itemCount,
          itemsSummary: result.itemsSummary,
          subtotalCents: result.subtotalCents,
          shippingCents: result.shippingCents,
          totalCents: result.totalCents,
          paymentMethod: result.paymentMethod,
          paymentRef: result.paymentRef,
          recipientName: recipientName.trim(),
          shippingAddress: shippingAddress.trim(),
          postalCode: postalCode.trim(),
          phone: phone.trim(),
        });
      }

      setConfirmedReceipt({
        orderNumber: result.orderNumber,
        totalCents: result.totalCents,
        paymentMethod: result.paymentMethod,
        paymentRef: result.paymentRef,
        itemsSummary: result.itemsSummary,
        recipientName: recipientName.trim(),
        shippingAddress: `${shippingAddress.trim()}, ${postalCode.trim()}`,
      });
      setCardNumber('');
      setCvc('');
      onClearCart();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to complete checkout.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="py-6 md:py-10 max-w-6xl mx-auto space-y-8">
      {/* Page Title & Mode Switch (Checkout vs Past Orders) */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-[#DED7C6]">
        <div>
          <p className="text-xs text-[#7A6350] mb-1.5">Bangladesh Express Dispatch</p>
          <h1 className="text-3xl md:text-4xl font-semibold text-[#2C1E16] text-balance">
            Shopping Bag &amp; Checkout
          </h1>
        </div>

        <div className="inline-flex items-center gap-1 p-1 bg-[#EFEBE0] rounded-lg self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setViewMode('checkout_flow')}
            className={`min-h-[38px] px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              viewMode === 'checkout_flow'
                ? 'bg-[#FCFBF7] text-[#2C1E16] shadow-xs'
                : 'text-[#6E5846] hover:text-[#2C1E16]'
            }`}
          >
            Checkout ({itemCount})
          </button>
          <button
            type="button"
            onClick={() => setViewMode('orders')}
            className={`min-h-[38px] px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              viewMode === 'orders'
                ? 'bg-[#FCFBF7] text-[#2C1E16] shadow-xs'
                : 'text-[#6E5846] hover:text-[#2C1E16]'
            }`}
          >
            Order History ({orders.length})
          </button>
        </div>
      </div>

      {/* Visual Progress Bar & 4-Stage Stepper (Shown across active Checkout Flow) */}
      {viewMode === 'checkout_flow' && (
        <section
          aria-label="Checkout progress"
          className="rounded-xl border border-[#DED7C6] bg-[#FCFBF7] p-5 md:p-6 space-y-5"
        >
          <div className="flex items-center justify-between gap-4 text-xs">
            <span className="font-medium text-[#2C1E16]">
              Stage {currentStage} of 4 — {STEPPER_STAGES[currentStage - 1].title}
            </span>
            <span className="font-mono tabular-nums text-[#7A6350]">
              {currentStage * 25}% Complete
            </span>
          </div>

          {/* Continuous Progress Track */}
          <div className="h-2 w-full rounded-full bg-[#E6E0D2] overflow-hidden">
            <div
              className={`h-full bg-[#435334] rounded-full transition-all duration-200 ${progressWidthClass}`}
            />
          </div>

          {/* 4 Interactive Stage Indicators */}
          <ol className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
            {STEPPER_STAGES.map((stepObj) => {
              const isCompleted = currentStage > stepObj.stage || currentStage === 4;
              const isCurrent = currentStage === stepObj.stage && currentStage !== 4;
              const isClickable =
                !confirmedReceipt &&
                stepObj.stage < 4 &&
                (stepObj.stage === 1 || cart.length > 0);

              return (
                <li key={stepObj.stage}>
                  <button
                    type="button"
                    disabled={!isClickable}
                    onClick={() => handleStepClick(stepObj.stage)}
                    aria-current={isCurrent ? 'step' : undefined}
                    className={`w-full text-left flex items-start gap-3 py-1.5 transition-opacity ${
                      isClickable ? 'cursor-pointer hover:opacity-90' : 'cursor-default'
                    }`}
                  >
                    <span
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-mono font-semibold shrink-0 border transition-colors ${
                        isCompleted
                          ? 'bg-[#435334] border-[#435334] text-[#FCFBF7]'
                          : isCurrent
                            ? 'bg-[#2C1E16] border-[#2C1E16] text-[#FCFBF7]'
                            : 'bg-[#F7F4EC] border-[#D4CCB8] text-[#7A6350]'
                      }`}
                    >
                      {isCompleted ? <Check className="w-3.5 h-3.5" /> : stepObj.stage}
                    </span>

                    <div className="min-w-0">
                      <p
                        className={`text-xs font-semibold truncate ${
                          isCurrent || isCompleted ? 'text-[#2C1E16]' : 'text-[#7A6350]'
                        }`}
                      >
                        {stepObj.title}
                      </p>
                      <p className="text-[11px] text-[#7A6350] truncate">
                        {isCompleted
                          ? 'Completed'
                          : isCurrent
                            ? 'In progress'
                            : stepObj.subtitle}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {/* Order History Archive View */}
      {viewMode === 'orders' ? (
        !userUid ? (
          <div className="rounded-xl border border-[#DED7C6] bg-[#FCFBF7] p-10 text-center space-y-4">
            <p className="text-base font-medium text-[#2C1E16]">Sign in to view past orders</p>
            <button
              type="button"
              onClick={() => void onSignInRequest()}
              className="min-h-[44px] px-5 py-2.5 text-xs font-medium bg-[#435334] text-[#FCFBF7] rounded-lg whitespace-nowrap"
            >
              Sign in with Google
            </button>
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-xl border border-[#DED7C6] bg-[#FCFBF7] p-12 text-center text-sm text-[#7A6350]">
            No confirmed orders recorded yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {orders.map((ord) => (
              <div
                key={ord.id}
                className="rounded-xl border border-[#DED7C6] bg-[#FCFBF7] p-5 space-y-3"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono font-medium text-[#2C1E16]">#{ord.orderNumber}</span>
                  <span className="capitalize text-[#435334] font-medium">{ord.status}</span>
                </div>
                <p className="text-xs text-[#5A4332] leading-relaxed">{ord.itemsSummary}</p>
                <p className="text-[11px] text-[#7A6350] truncate">
                  {ord.recipientName} · {ord.shippingAddress}
                </p>
                <div className="flex items-center justify-between pt-3 border-t border-[#EFEBE0] text-xs text-[#7A6350]">
                  <span>{ord.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Verified Card'}</span>
                  <span className="font-mono tabular-nums font-medium text-[#2C1E16]">
                    {formatTaka(ord.totalCents)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )
      ) : confirmedReceipt ? (
        /* Stage 4: Verified Order Confirmation View */
        <div className="rounded-xl border border-[#DED7C6] bg-[#FCFBF7] p-6 md:p-10 max-w-2xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 text-[#435334] text-sm font-medium">
            <CheckCircle2 className="w-5 h-5" />
            <span>Stage 4 Complete · Order Verified &amp; Confirmed</span>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl md:text-3xl font-semibold text-[#2C1E16] text-balance">
              Order #{confirmedReceipt.orderNumber} Confirmed — Preparing Dhaka Dispatch
            </h2>
            <p className="text-sm text-[#5A4332] leading-relaxed">
              Thank you for shopping with RADIANCE. Your garments are being steam-pressed and packed at our Dhaka atelier.
            </p>
          </div>

          <div className="pt-5 border-t border-[#DED7C6] space-y-2.5 text-xs">
            <div className="flex justify-between gap-4">
              <span className="text-[#7A6350]">Recipient</span>
              <span className="text-[#2C1E16] font-medium text-right">
                {confirmedReceipt.recipientName}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-[#7A6350]">Delivery Destination</span>
              <span className="text-[#2C1E16] text-right">
                {confirmedReceipt.shippingAddress}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-[#7A6350]">Items</span>
              <span className="text-[#2C1E16] font-medium text-right">
                {confirmedReceipt.itemsSummary}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-[#7A6350]">Total Amount (BDT)</span>
              <span className="font-mono tabular-nums font-semibold text-[#435334]">
                {formatTaka(confirmedReceipt.totalCents)}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-[#7A6350]">Payment Method</span>
              <span className="text-[#2C1E16]">
                {confirmedReceipt.paymentMethod === 'cod'
                  ? 'Cash on Delivery (BDT)'
                  : 'Verified Card (BDT)'}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-[#7A6350]">Verification Token</span>
              <span className="font-mono text-[11px] text-[#5A4332] truncate max-w-[220px]">
                {confirmedReceipt.paymentRef}
              </span>
            </div>
          </div>

          <div className="pt-4 border-t border-[#DED7C6] flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setConfirmedReceipt(null);
                setCheckoutStep(1);
              }}
              className="min-h-[42px] px-5 py-2.5 text-xs font-medium text-[#2C1E16] border border-[#D4CCB8] hover:border-[#435334] rounded-lg transition-colors whitespace-nowrap"
            >
              Start Another Order
            </button>
            {userUid && (
              <button
                type="button"
                onClick={() => {
                  setConfirmedReceipt(null);
                  setCheckoutStep(1);
                  setViewMode('orders');
                }}
                className="min-h-[42px] px-5 py-2.5 text-xs font-medium bg-[#435334] text-[#FCFBF7] rounded-lg hover:bg-[#344227] transition-colors whitespace-nowrap"
              >
                View Order History
              </button>
            )}
          </div>
        </div>
      ) : cart.length === 0 ? (
        <div className="rounded-xl border border-[#DED7C6] bg-[#FCFBF7] p-12 text-center space-y-3">
          <ShoppingBag className="w-6 h-6 text-[#7A6350] mx-auto" />
          <h2 className="text-lg font-medium text-[#2C1E16]">Your Shopping Bag is Empty</h2>
          <p className="text-sm text-[#7A6350] max-w-md mx-auto">
            Select sizes from the Collection, Outfit Advisor, Fitting Room, or My Favorites to add pieces to your bag.
          </p>
        </div>
      ) : (
        /* Clearly Separated 2-Zone Layout: Left Form/Stage Workspace vs Right Tinted Cart Summary Ledger */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* LEFT ZONE (7 Cols): Active Stage Workspace (Customer Form Fields or Editable Bag) */}
          <div className="lg:col-span-7">
            {/* STAGE 1 WORKSPACE: Editable Shopping Bag */}
            {checkoutStep === 1 && (
              <section
                aria-label="Shopping bag items"
                className="rounded-xl border border-[#DED7C6] bg-[#FCFBF7] p-6 md:p-8 space-y-6"
              >
                <div className="flex items-baseline justify-between gap-4 pb-4 border-b border-[#DED7C6]">
                  <div>
                    <p className="text-xs text-[#7A6350]">Step 1 of 3</p>
                    <h2 className="text-xl font-semibold text-[#2C1E16] mt-0.5">
                      Review Your Selected Pieces
                    </h2>
                  </div>
                  <span className="text-xs font-mono tabular-nums text-[#5A4332]">
                    {itemCount} {itemCount === 1 ? 'Item' : 'Items'}
                  </span>
                </div>

                <div className="divide-y divide-[#E6E0D2]">
                  {cart.map((entry) => (
                    <div
                      key={`${entry.garment.id}_${entry.size}`}
                      className="py-5 first:pt-0 last:pb-0 flex gap-4 sm:gap-5"
                    >
                      <div className="w-20 sm:w-24 aspect-[3/4] rounded-lg overflow-hidden border border-[#DED7C6] bg-[#EFEBE0] shrink-0">
                        <GarmentVisual
                          src={entry.garment.imageDataUrl}
                          alt={entry.garment.name}
                          tone={entry.garment.colorTone}
                          category={entry.garment.category}
                          className="w-full h-full"
                        />
                      </div>

                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <div>
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-xs text-[#7A6350]">
                                {entry.garment.category} · Size {entry.size}
                              </p>
                              <h3 className="text-sm sm:text-base font-semibold text-[#2C1E16] mt-0.5">
                                {entry.garment.name}
                              </h3>
                            </div>
                            <button
                              type="button"
                              onClick={() => onRemoveItem(entry.garment.id, entry.size)}
                              className="min-h-[36px] min-w-[36px] flex items-center justify-center text-[#7A6350] hover:text-red-800 transition-colors shrink-0"
                              aria-label={`Remove ${entry.garment.name}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <p className="text-xs text-[#5A4332] mt-1">
                            {entry.garment.colorName} · {formatTaka(entry.garment.priceCents)} each
                          </p>
                        </div>

                        <div className="flex items-center justify-between gap-3 mt-4">
                          <div className="inline-flex items-center border border-[#D4CCB8] bg-white rounded-lg">
                            <button
                              type="button"
                              onClick={() => onUpdateQuantity(entry.garment.id, entry.size, -1)}
                              className="min-h-[38px] min-w-[38px] flex items-center justify-center text-[#5A4332] hover:text-[#2C1E16]"
                              aria-label="Decrease quantity"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="px-3 text-xs font-mono tabular-nums font-medium text-[#2C1E16]">
                              {entry.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => onUpdateQuantity(entry.garment.id, entry.size, 1)}
                              className="min-h-[38px] min-w-[38px] flex items-center justify-center text-[#5A4332] hover:text-[#2C1E16]"
                              aria-label="Increase quantity"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <span className="text-sm sm:text-base font-mono tabular-nums font-semibold text-[#2C1E16]">
                            {formatTaka(entry.garment.priceCents * entry.quantity)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-5 border-t border-[#DED7C6] flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMsg(null);
                      setCheckoutStep(2);
                    }}
                    className="min-h-[46px] inline-flex items-center justify-center gap-2 px-6 py-3 text-xs sm:text-sm font-medium text-[#FCFBF7] bg-[#435334] hover:bg-[#344227] rounded-lg transition-colors whitespace-nowrap shrink-0"
                  >
                    <span>Continue to Delivery Info</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </section>
            )}

            {/* STAGE 2 WORKSPACE: Customer Delivery Information Form */}
            {checkoutStep === 2 && (
              <form
                onSubmit={handleAdvanceToPayment}
                className="rounded-xl border border-[#DED7C6] bg-[#FCFBF7] p-6 md:p-8 space-y-6"
              >
                <div className="flex items-start justify-between gap-4 pb-5 border-b border-[#DED7C6]">
                  <div>
                    <p className="text-xs text-[#7A6350]">Step 2 of 3 · Customer Information</p>
                    <h2 className="text-xl font-semibold text-[#2C1E16] mt-0.5 flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-[#435334] shrink-0" />
                      <span>Bangladesh Delivery Details</span>
                    </h2>
                  </div>
                </div>

                {!userUid && (
                  <div className="pb-5 border-b border-[#E6E0D2] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <p className="text-xs text-[#5A4332]">
                      Sign in with Google to save verified order receipts to your RADIANCE account.
                    </p>
                    <button
                      type="button"
                      onClick={() => void onSignInRequest()}
                      className="self-start sm:self-auto min-h-[38px] px-4 py-1.5 text-xs font-medium text-[#2C1E16] bg-[#F7F4EC] border border-[#D4CCB8] hover:border-[#435334] rounded-lg whitespace-nowrap shrink-0"
                    >
                      Sign In
                    </button>
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="checkout-recipient"
                      className="block text-xs font-medium text-[#2C1E16] mb-1.5"
                    >
                      Recipient Full Name
                    </label>
                    <input
                      id="checkout-recipient"
                      type="text"
                      required
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      placeholder="Nadia Rahman"
                      className="w-full min-h-[46px] px-3.5 py-2.5 text-sm bg-white rounded-lg border border-[#D4CCB8] text-[#2C1E16] focus:border-[#435334] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="checkout-address"
                      className="block text-xs font-medium text-[#2C1E16] mb-1.5"
                    >
                      House, Road, Area &amp; District
                    </label>
                    <input
                      id="checkout-address"
                      type="text"
                      required
                      value={shippingAddress}
                      onChange={(e) => setShippingAddress(e.target.value)}
                      placeholder="House 14, Road 11, Banani, Dhaka"
                      className="w-full min-h-[46px] px-3.5 py-2.5 text-sm bg-white rounded-lg border border-[#D4CCB8] text-[#2C1E16] focus:border-[#435334] focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="checkout-postal"
                        className="block text-xs font-medium text-[#2C1E16] mb-1.5"
                      >
                        Postal Code
                      </label>
                      <input
                        id="checkout-postal"
                        type="text"
                        required
                        value={postalCode}
                        onChange={(e) => setPostalCode(e.target.value)}
                        placeholder="1213"
                        className="w-full min-h-[46px] px-3.5 py-2.5 text-sm font-mono tabular-nums bg-white rounded-lg border border-[#D4CCB8] text-[#2C1E16] focus:border-[#435334] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="checkout-phone"
                        className="block text-xs font-medium text-[#2C1E16] mb-1.5"
                      >
                        Mobile Number
                      </label>
                      <input
                        id="checkout-phone"
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+880 1711-000000"
                        className="w-full min-h-[46px] px-3.5 py-2.5 text-sm font-mono tabular-nums bg-white rounded-lg border border-[#D4CCB8] text-[#2C1E16] focus:border-[#435334] focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {errorMsg && (
                  <p className="text-xs font-medium text-red-800 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
                    {errorMsg}
                  </p>
                )}

                <div className="pt-5 border-t border-[#DED7C6] flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMsg(null);
                      setCheckoutStep(1);
                    }}
                    className="min-h-[42px] inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-[#5A4332] hover:text-[#2C1E16] transition-colors whitespace-nowrap"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Bag</span>
                  </button>

                  <button
                    type="submit"
                    className="min-h-[46px] inline-flex items-center justify-center gap-2 px-6 py-3 text-xs sm:text-sm font-medium text-[#FCFBF7] bg-[#435334] hover:bg-[#344227] rounded-lg transition-colors whitespace-nowrap shrink-0"
                  >
                    <span>Continue to Payment</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </form>
            )}

            {/* STAGE 3 WORKSPACE: Payment Verification Form */}
            {checkoutStep === 3 && (
              <form
                id="checkout-payment-form"
                onSubmit={handlePlaceOrder}
                className="rounded-xl border border-[#DED7C6] bg-[#FCFBF7] p-6 md:p-8 space-y-6"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 pb-5 border-b border-[#DED7C6]">
                  <div>
                    <p className="text-xs text-[#7A6350]">Step 3 of 3 · Payment Verification</p>
                    <h2 className="text-xl font-semibold text-[#2C1E16] mt-0.5 flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-[#435334] shrink-0" />
                      <span>Select Payment Method (BDT ৳)</span>
                    </h2>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-xs text-[#435334] font-medium">
                    <ShieldCheck className="w-4 h-4" />
                    <span>HMAC Signed Receipt</span>
                  </span>
                </div>

                {/* Read-Only Delivery Recap with Quick Edit */}
                <div className="pb-5 border-b border-[#E6E0D2] flex items-start justify-between gap-4 text-xs">
                  <div className="space-y-1">
                    <span className="text-[#7A6350] block">Dispatching To</span>
                    <p className="font-medium text-[#2C1E16]">
                      {recipientName} · <span className="font-mono">{phone}</span>
                    </p>
                    <p className="text-[#5A4332]">
                      {shippingAddress}, {postalCode}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCheckoutStep(2)}
                    className="min-h-[36px] px-3 py-1 text-xs font-medium text-[#435334] hover:underline underline-offset-4 whitespace-nowrap shrink-0"
                  >
                    Edit Address
                  </button>
                </div>

                {/* Payment Method Selector */}
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2 p-1 bg-[#EFEBE0] rounded-lg">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('cod')}
                      className={`min-h-[42px] py-2 px-3 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                        paymentMethod === 'cod'
                          ? 'bg-[#FCFBF7] text-[#2C1E16] shadow-xs'
                          : 'text-[#6E5846] hover:text-[#2C1E16]'
                      }`}
                    >
                      Cash on Delivery
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('card')}
                      className={`min-h-[42px] py-2 px-3 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                        paymentMethod === 'card'
                          ? 'bg-[#FCFBF7] text-[#2C1E16] shadow-xs'
                          : 'text-[#6E5846] hover:text-[#2C1E16]'
                      }`}
                    >
                      Credit / Debit Card
                    </button>
                  </div>

                  {paymentMethod === 'card' ? (
                    <div className="space-y-4 pt-1">
                      <div>
                        <label
                          htmlFor="checkout-card-name"
                          className="block text-xs font-medium text-[#2C1E16] mb-1.5"
                        >
                          Name on Card
                        </label>
                        <input
                          id="checkout-card-name"
                          type="text"
                          required
                          value={cardholderName}
                          onChange={(e) => setCardholderName(e.target.value)}
                          placeholder="NADIA RAHMAN"
                          className="w-full min-h-[46px] px-3.5 py-2.5 text-sm bg-white rounded-lg border border-[#D4CCB8] text-[#2C1E16] focus:border-[#435334] focus:outline-none"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="checkout-card-number"
                          className="block text-xs font-medium text-[#2C1E16] mb-1.5"
                        >
                          Card Number
                        </label>
                        <input
                          id="checkout-card-number"
                          type="text"
                          inputMode="numeric"
                          required
                          value={cardNumber}
                          onChange={(e) => setCardNumber(formatCardNumberInput(e.target.value))}
                          placeholder="4532 0151 1283 0366"
                          className="w-full min-h-[46px] px-3.5 py-2.5 text-sm font-mono tabular-nums bg-white rounded-lg border border-[#D4CCB8] text-[#2C1E16] focus:border-[#435334] focus:outline-none"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label
                            htmlFor="checkout-card-expiry"
                            className="block text-xs font-medium text-[#2C1E16] mb-1.5"
                          >
                            Expiry (MM/YY)
                          </label>
                          <input
                            id="checkout-card-expiry"
                            type="text"
                            inputMode="numeric"
                            required
                            value={expiry}
                            onChange={(e) => setExpiry(formatExpiryInput(e.target.value))}
                            placeholder="08/29"
                            className="w-full min-h-[46px] px-3.5 py-2.5 text-sm font-mono tabular-nums bg-white rounded-lg border border-[#D4CCB8] text-[#2C1E16] focus:border-[#435334] focus:outline-none"
                          />
                        </div>
                        <div>
                          <label
                            htmlFor="checkout-card-cvc"
                            className="block text-xs font-medium text-[#2C1E16] mb-1.5"
                          >
                            Security Code (CVC)
                          </label>
                          <input
                            id="checkout-card-cvc"
                            type="password"
                            inputMode="numeric"
                            required
                            maxLength={4}
                            value={cvc}
                            onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
                            placeholder="123"
                            className="w-full min-h-[46px] px-3.5 py-2.5 text-sm font-mono tabular-nums bg-white rounded-lg border border-[#D4CCB8] text-[#2C1E16] focus:border-[#435334] focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="py-3 text-xs text-[#5A4332] leading-relaxed space-y-1.5">
                      <p className="font-medium text-[#2C1E16]">
                        Cash on Delivery Across Bangladesh
                      </p>
                      <p>
                        Pay <strong className="font-mono tabular-nums">{formatTaka(totalCents)}</strong> in Bangladeshi Taka (৳) directly to the courier upon parcel arrival in Dhaka, Chattogram, Sylhet, or nationwide.
                      </p>
                    </div>
                  )}
                </div>

                {errorMsg && (
                  <p className="text-xs font-medium text-red-800 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
                    {errorMsg}
                  </p>
                )}

                <div className="pt-5 border-t border-[#DED7C6] flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMsg(null);
                      setCheckoutStep(2);
                    }}
                    className="min-h-[42px] inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-[#5A4332] hover:text-[#2C1E16] transition-colors whitespace-nowrap"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Delivery</span>
                  </button>

                  <button
                    type="submit"
                    disabled={processing}
                    className="min-h-[48px] inline-flex items-center justify-center gap-2 px-7 py-3 text-sm font-medium text-[#FCFBF7] bg-[#435334] hover:bg-[#344227] disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
                  >
                    <span>
                      {processing
                        ? 'Verifying & Signing Order...'
                        : `Complete Order — ${formatTaka(totalCents)}`}
                    </span>
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* RIGHT ZONE (5 Cols): Distinct Warm-Linen Cart & Order Summary Card */}
          <aside
            aria-label="Cart and order summary"
            className="lg:col-span-5 lg:sticky lg:top-24 rounded-xl border border-[#CFC6B2] bg-[#EFEBE0] p-6 md:p-7 space-y-6"
          >
            <div className="flex items-baseline justify-between gap-3 pb-4 border-b border-[#D8D0BE]">
              <div>
                <p className="text-[11px] text-[#6E5846]">Order Ledger</p>
                <h2 className="text-lg font-semibold text-[#2C1E16] mt-0.5">
                  Cart &amp; Summary ({itemCount})
                </h2>
              </div>
              {checkoutStep > 1 && (
                <button
                  type="button"
                  onClick={() => setCheckoutStep(1)}
                  className="text-xs font-medium text-[#435334] hover:underline underline-offset-4 whitespace-nowrap shrink-0"
                >
                  Edit Bag
                </button>
              )}
            </div>

            {/* Compact Itemized Cart Preview (Always Visible While Filling Forms on Steps 2 & 3) */}
            {checkoutStep > 1 && (
              <div className="divide-y divide-[#D8D0BE] max-h-72 overflow-y-auto pr-1">
                {cart.map((entry) => (
                  <div
                    key={`summary_${entry.garment.id}_${entry.size}`}
                    className="py-3 first:pt-0 last:pb-0 flex items-center gap-3.5"
                  >
                    <div className="w-12 aspect-[3/4] rounded overflow-hidden border border-[#D4CCB8] bg-[#FCFBF7] shrink-0">
                      <GarmentVisual
                        src={entry.garment.imageDataUrl}
                        alt={entry.garment.name}
                        tone={entry.garment.colorTone}
                        category={entry.garment.category}
                        className="w-full h-full"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-[#2C1E16] truncate">
                        {entry.garment.name}
                      </p>
                      <p className="text-[11px] text-[#6E5846] mt-0.5">
                        Size {entry.size} · Qty {entry.quantity}
                      </p>
                    </div>
                    <span className="text-xs font-mono tabular-nums font-medium text-[#2C1E16] shrink-0">
                      {formatTaka(entry.garment.priceCents * entry.quantity)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Complimentary Courier Progress Meter */}
            <div className="pt-1 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#5A4332]">Free Courier Threshold</span>
                <span className="font-mono tabular-nums text-[#2C1E16]">
                  {freeShippingRemaining === 0 ? 'Unlocked (৳4,000+)' : '৳4,000'}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-[#DCD4C2] overflow-hidden">
                <div
                  className={`h-full bg-[#435334] rounded-full transition-all duration-200 ${getShippingProgressWidthClass(
                    subtotalCents,
                    FREE_SHIPPING_THRESHOLD_POISHA
                  )}`}
                />
              </div>
              <p className="text-[11px] text-[#6E5846] leading-relaxed">
                {freeShippingRemaining === 0 ? (
                  'Complimentary express courier across Bangladesh applied to this bag.'
                ) : (
                  <>
                    Add{' '}
                    <strong className="font-mono tabular-nums text-[#435334]">
                      {formatTaka(freeShippingRemaining)}
                    </strong>{' '}
                    more for complimentary express courier (standard courier ৳120).
                  </>
                )}
              </p>
            </div>

            {/* Financial Totals Breakdown */}
            <div className="pt-4 border-t border-[#D8D0BE] space-y-2.5 text-xs">
              <div className="flex justify-between text-[#5A4332]">
                <span>Pieces Subtotal</span>
                <span className="font-mono tabular-nums">{formatTaka(subtotalCents)}</span>
              </div>
              <div className="flex justify-between text-[#5A4332]">
                <span>Bangladesh Express Courier</span>
                <span className="font-mono tabular-nums">
                  {shippingCents === 0 ? 'Complimentary' : formatTaka(shippingCents)}
                </span>
              </div>
              <div className="flex justify-between items-baseline text-base font-semibold text-[#2C1E16] pt-3 border-t border-[#D8D0BE]">
                <span>Total Payable (BDT)</span>
                <span className="font-mono tabular-nums text-lg text-[#435334]">
                  {formatTaka(totalCents)}
                </span>
              </div>
            </div>

            {checkoutStep === 1 && (
              <button
                type="button"
                onClick={() => {
                  setErrorMsg(null);
                  setCheckoutStep(2);
                }}
                className="w-full min-h-[46px] inline-flex items-center justify-center gap-2 py-3 px-5 text-sm font-medium text-[#FCFBF7] bg-[#435334] hover:bg-[#344227] rounded-lg transition-colors whitespace-nowrap"
              >
                <span>Proceed to Delivery — {formatTaka(totalCents)}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
